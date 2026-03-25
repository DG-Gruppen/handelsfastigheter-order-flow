import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrderFormData, resolveApprovalRouting } from "@/hooks/useOrderFormData";
import { sendHelpdeskEmail } from "@/lib/sendHelpdeskEmail";
import { sendNewOrderEmailToApprover, sendApprovalEmail } from "@/lib/orderEmails";
import { getAppBaseUrl } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Plus, Trash2 } from "lucide-react";
import { getIcon } from "@/lib/icons";

interface OrderItem {
  uid: string;
  typeId: string;
}

export default function NewOrder() {
  const { user, roles } = useAuth();
  const isManagerOrAdmin = roles.includes("manager") || roles.includes("admin");
  const isIT = roles.includes("it");
  const isPrivileged = isManagerOrAdmin || isIT;
  const navigate = useNavigate();

  const { data: refData } = useOrderFormData();

  const categories = refData?.categories ?? [];
  const orderTypes = refData?.orderTypes ?? [];
  const allProfiles = refData?.allProfiles ?? [];
  const approvalSettings = refData?.approvalSettings ?? {};
  const myProfile = refData?.myProfile ?? null;
  const ceoProfile = refData?.ceoProfile ?? null;
  const myManagerProfile = refData?.myManagerProfile ?? null;

  // Form state
  const [selectedExistingRecipient, setSelectedExistingRecipient] = useState<string>("self");
  const [items, setItems] = useState<OrderItem[]>([{ uid: crypto.randomUUID(), typeId: "" }]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derived approval state
  const isManager = roles.includes("manager");
  const isStaff = myProfile?.is_staff === true;
  const reportsDirectlyToCeo = !myProfile?.manager_id || (ceoProfile != null && myProfile?.manager_id === ceoProfile?.id);
  const { needsCeoApproval: needsCeoApprovalCheck, needsManagerApproval } = resolveApprovalRouting({
    isCeo: !!(ceoProfile && ceoProfile.user_id === user?.id),
    isManagerOrAdmin,
    isManager,
    isStaff,
    isIT,
    reportsDirectlyToCeo,
    approvalSettings,
    ceoProfileId: ceoProfile?.user_id ?? null,
    myManagerProfile,
    currentUserId: user?.id ?? "",
  });

  const addItem = () => setItems((prev) => [...prev, { uid: crypto.randomUUID(), typeId: "" }]);
  const removeItem = (uid: string) => setItems((prev) => prev.filter((item) => item.uid !== uid));
  const updateItem = (uid: string, value: string) => {
    setItems((prev) => prev.map((item) => (item.uid === uid ? { ...item, typeId: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.typeId);

    if (!user || validItems.length === 0 || (!isPrivileged && !myManagerProfile)) {
      toast.error(!myManagerProfile && !isPrivileged
        ? "Du har ingen chef kopplad till din profil. Kontakta din administratör."
        : "Lägg till minst en utrustning");
      return;
    }

    setSubmitting(true);

    const isCeo = !!(ceoProfile && ceoProfile.user_id === user.id);
    const rdtc = !myProfile?.manager_id || (ceoProfile != null && myProfile?.manager_id === ceoProfile?.id);

    const { autoApprove, needsCeoApproval, needsManagerApproval: needsMgrApproval, resolvedApproverId } = resolveApprovalRouting({
      isCeo,
      isManagerOrAdmin,
      isManager: roles.includes("manager"),
      isStaff: myProfile?.is_staff === true,
      isIT,
      reportsDirectlyToCeo: rdtc,
      approvalSettings,
      ceoProfileId: ceoProfile?.user_id ?? null,
      myManagerProfile,
      currentUserId: user.id,
    });

    const firstType = orderTypes.find((t) => t.id === validItems[0].typeId);
    const existingRecipientName = isPrivileged && selectedExistingRecipient !== "self"
      ? allProfiles.find(p => p.user_id === selectedExistingRecipient)?.full_name ?? null
      : null;

    const baseTitle = validItems.length === 1
      ? firstType?.name ?? "Beställning"
      : `${firstType?.name ?? "Beställning"} + ${validItems.length - 1} till`;

    const title = existingRecipientName
      ? `${baseTitle} – ${existingRecipientName}`
      : baseTitle;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        requester_id: user.id,
        approver_id: resolvedApproverId,
        order_type_id: validItems[0].typeId,
        category_id: firstType?.category_id ?? null,
        title,
        description: description.trim(),
        recipient_type: "existing",
        recipient_name: isPrivileged
          ? (selectedExistingRecipient === "self"
            ? ""
            : (allProfiles.find(p => p.user_id === selectedExistingRecipient)?.full_name ?? ""))
          : "",
        recipient_start_date: null,
        recipient_department: "",
        order_reason: "broken_equipment",
        status: autoApprove ? "approved" : "pending",
        approved_at: autoApprove ? new Date().toISOString() : null,
      } as any)
      .select("id")
      .single();

    if (orderError || !order) {
      toast.error("Kunde inte skapa beställningen");
      console.error("Order insert error:", orderError);
      setSubmitting(false);
      return;
    }

    const orderItemsToInsert = validItems.map((it) => {
      const ot = orderTypes.find((t) => t.id === it.typeId);
      return {
        order_id: order.id,
        order_type_id: it.typeId,
        category_id: ot?.category_id ?? null,
        name: ot?.name ?? "",
        description: ot?.description ?? "",
        quantity: 1,
      };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsToInsert as any);
    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      toast.error("Kunde inte lägga till utrustning. Beställningen avbröts.");
      setSubmitting(false);
      return;
    }

    // Notification + email for approver (if not auto-approved)
    if (!autoApprove && resolvedApproverId && resolvedApproverId !== user.id) {
      const requesterName = allProfiles.find(p => p.user_id === user.id)?.full_name || "Någon";
      const { data: requesterEmailData } = await supabase.from("profiles").select("email").eq("user_id", user.id).single();
      await supabase.rpc("create_notification", {
        _user_id: resolvedApproverId,
        _title: "Ny beställning att attestera",
        _message: `${requesterName} har skickat en beställning: ${title}`,
        _type: "approval_request",
        _reference_id: order.id,
      });

      const approverProfileData = allProfiles.find(p => p.user_id === resolvedApproverId);
      if (approverProfileData) {
        const { data: approverEmailData } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", resolvedApproverId)
          .single();
        if (approverEmailData?.email) {
          await sendNewOrderEmailToApprover({
            orderId: order.id,
            title,
            description: description.trim(),
            requesterName,
            requesterEmail: requesterEmailData?.email || "",
            approverName: approverProfileData.full_name,
            approverEmail: approverEmailData.email,
            items: orderItemsToInsert.map((i) => ({ name: i.name, description: i.description, quantity: i.quantity })),
            recipientName: existingRecipientName,
          });
        }
      }
    }

    // Helpdesk email + confirmation for auto-approved orders
    if (autoApprove) {
      const requesterProfile = allProfiles.find(p => p.user_id === user.id);
      const { data: reqEmail } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();
      const requesterEmail = reqEmail?.email || "";

      await sendHelpdeskEmail({
        orderId: order.id,
        title,
        description: description.trim(),
        recipientName: existingRecipientName,
        recipientDepartment: null,
        recipientStartDate: null,
        orderReason: "broken_equipment",
        requesterName: requesterProfile?.full_name || "Okänd",
        requesterEmail,
        items: orderItemsToInsert.map((i) => ({ name: i.name, description: i.description, quantity: i.quantity })),
      });

      if (requesterEmail) {
        await sendApprovalEmail({
          orderId: order.id,
          recipientName: requesterProfile?.full_name || "du",
          recipientEmail: requesterEmail,
          title,
          items: orderItemsToInsert.map((i) => ({ name: i.name, quantity: i.quantity })),
          isAutoApproved: true,
        });
      }
    }

    const successMsg = autoApprove
      ? "Beställningen har godkänts automatiskt och är redo att skickas till extern IT!"
      : needsCeoApproval
        ? "Beställningen har skickats till VD för attestering!"
        : needsMgrApproval
          ? "Beställningen har skickats till din chef för attestering!"
          : "Beställningen har skickats till din chef för godkännande!";
    toast.success(successMsg);
    navigate("/dashboard");
    setSubmitting(false);
  };

  const grouped = categories
    .map((cat) => ({
      category: cat,
      types: orderTypes.filter((ot) => ot.category_id === cat.id),
    }))
    .filter((g) => g.types.length > 0);

  const uncategorized = orderTypes.filter(
    (ot) => !ot.category_id || !categories.some((c) => c.id === ot.category_id)
  );

  const renderTypeSelect = (item: OrderItem) => (
    <Select value={item.typeId} onValueChange={(v) => updateItem(item.uid, v)}>
      <SelectTrigger className="h-12 md:h-10 flex-1">
        <SelectValue placeholder="Välj utrustning..." />
      </SelectTrigger>
      <SelectContent>
        {grouped.map(({ category, types }) => {
          const CatIcon = getIcon(category.icon);
          return (
            <div key={category.id}>
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CatIcon className="h-3.5 w-3.5" />
                {category.name}
              </div>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id} className="py-3 md:py-2">
                  {t.name}
                </SelectItem>
              ))}
            </div>
          );
        })}
        {uncategorized.length > 0 && (
          <div>
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">Övrigt</div>
            {uncategorized.map((t) => (
              <SelectItem key={t.id} value={t.id} className="py-3 md:py-2">
                {t.name}
              </SelectItem>
            ))}
          </div>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <Card className="glass-card shadow-xl shadow-primary/[0.03]">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="font-heading text-lg md:text-xl">Ny beställning</CardTitle>
          <CardDescription className="text-sm">
            Beställ IT-utrustning för dig själv eller en medarbetare. Beställningen skickas till vald chef för attestering.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">

            {/* Existing employee picker for managers */}
            {isPrivileged && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Beställ till *</Label>
                <Select value={selectedExistingRecipient} onValueChange={setSelectedExistingRecipient}>
                  <SelectTrigger className="h-12 md:h-10">
                    <SelectValue placeholder="Välj medarbetare..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self" className="py-3 md:py-2">Mig själv</SelectItem>
                    {allProfiles
                      .filter((p) => p.user_id !== user?.id)
                      .map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id} className="py-3 md:py-2">
                          {p.full_name || p.user_id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Equipment items */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Utrustning *</Label>
              {items.map((item) => (
                <div key={item.uid} className="flex items-center gap-2">
                  {renderTypeSelect(item)}
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.uid)}
                      className="h-12 w-12 md:h-10 md:w-10 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addItem} className="gap-1.5 text-sm h-11 md:h-9 px-4">
                <Plus className="h-4 w-4" />
                Lägg till utrustning
              </Button>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Kommentar</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ytterligare information, t.ex. speciella behov..."
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
            </div>

            {/* Approver info */}
            {needsCeoApprovalCheck && ceoProfile && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Attesteras av VD:</span>{" "}
                  {ceoProfile.full_name}
                </p>
              </div>
            )}
            {needsManagerApproval && myManagerProfile && !needsCeoApprovalCheck && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Attesteras av:</span>{" "}
                  {myManagerProfile.full_name}
                </p>
              </div>
            )}
            {!isPrivileged && myManagerProfile && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Attesteras av:</span>{" "}
                  {myManagerProfile.full_name}
                </p>
              </div>
            )}
            {!isPrivileged && !myManagerProfile && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">
                  Du har ingen chef kopplad till din profil. Kontakta din administratör.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2 h-12 md:h-11 text-base gradient-primary hover:opacity-90 shadow-md shadow-primary/20"
              disabled={submitting}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Skickar..." : "Skicka beställning"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
