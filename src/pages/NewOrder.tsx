import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Send, Plus, Trash2, UserPlus, User, LogOut } from "lucide-react";
import { getIcon } from "@/lib/icons";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface OrderType {
  id: string;
  name: string;
  category_id: string | null;
  description: string;
  icon: string;
}

interface ProfileOption {
  id: string;
  user_id: string;
  full_name: string;
}

interface OrderItem {
  typeId: string;
}

const ORDER_REASONS_NEW = [
  { value: "new_employee", label: "Nyanställning" },
] as const;

const ORDER_REASONS_EXISTING = [
  { value: "broken_equipment", label: "Trasig utrustning" },
  { value: "end_of_employment", label: "Avslut av anställning (Offboarding)" },
] as const;

export default function NewOrder() {
  const { user, roles } = useAuth();
  const isManagerOrAdmin = roles.includes("manager") || roles.includes("admin");
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [managers, setManagers] = useState<ProfileOption[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileOption[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);
  const [approvalSettings, setApprovalSettings] = useState<Record<string, string>>({});
  const [myProfile, setMyProfile] = useState<{ is_staff: boolean | null; manager_id: string | null } | null>(null);
  const [ceoProfile, setCeoProfile] = useState<ProfileOption | null>(null);
  // Form state
  const [recipientType, setRecipientType] = useState<"existing" | "new">("existing");
  const [selectedExistingRecipient, setSelectedExistingRecipient] = useState<string>("self");
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const recipientName = `${recipientFirstName} ${recipientLastName}`.trim();
  const [recipientStartDate, setRecipientStartDate] = useState("");
  const [recipientEndDate, setRecipientEndDate] = useState("");
  const [recipientDepartment, setRecipientDepartment] = useState("");
  const [orderReason, setOrderReason] = useState("broken_equipment");

  const isOffboarding = recipientType === "existing" && orderReason === "end_of_employment";
  const activeReasons = recipientType === "new" ? ORDER_REASONS_NEW : ORDER_REASONS_EXISTING;
  const [items, setItems] = useState<OrderItem[]>([{ typeId: "" }]);
  const [approverId, setApproverId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [catsRes, typesRes, profilesRes, allProfilesRes, rolesRes, myProfileRes, catDeptsRes, otDeptsRes, approvalRes] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("order_types").select("*").eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, user_id, full_name").neq("user_id", user?.id ?? ""),
        supabase.from("profiles").select("id, user_id, full_name").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, department, is_staff, manager_id").eq("user_id", user?.id ?? "").single(),
        supabase.from("category_departments").select("category_id, department_id"),
        supabase.from("order_type_departments").select("order_type_id, department_id"),
        supabase.from("org_chart_settings").select("setting_key, setting_value").in("setting_key", ["approval_managers_to_ceo", "approval_staff_to_ceo"]),
      ]);

      const allCats = (catsRes.data as Category[]) ?? [];
      const allTypes = (typesRes.data as OrderType[]) ?? [];
      setAllProfiles((allProfilesRes.data as ProfileOption[]) ?? []);

      // Store my profile info for staff/manager checks
      if (myProfileRes.data) {
        setMyProfile({ is_staff: (myProfileRes.data as any).is_staff, manager_id: (myProfileRes.data as any).manager_id });
      }

      // Store approval settings
      const aMap: Record<string, string> = {};
      for (const s of (approvalRes.data as any[]) ?? []) aMap[s.setting_key] = s.setting_value;
      setApprovalSettings(aMap);

      // Build department restriction maps
      const catDeptMap: Record<string, string[]> = {};
      for (const row of (catDeptsRes.data as any[]) ?? []) {
        if (!catDeptMap[row.category_id]) catDeptMap[row.category_id] = [];
        catDeptMap[row.category_id].push(row.department_id);
      }
      const otDeptMap: Record<string, string[]> = {};
      for (const row of (otDeptsRes.data as any[]) ?? []) {
        if (!otDeptMap[row.order_type_id]) otDeptMap[row.order_type_id] = [];
        otDeptMap[row.order_type_id].push(row.department_id);
      }

      // Get user's department id
      const userDept = (myProfileRes.data as any)?.department ?? "";

      // Find matching department id from departments table
      const { data: deptRows } = await supabase.from("departments").select("id, name").order("name");
      setDepartmentsList((deptRows as any[]) ?? []);
      const userDeptId = (deptRows ?? []).find((d: any) => d.name === userDept)?.id;

      // Filter: no rows in junction = visible to all; otherwise must include user's dept
      const isAdmin = roles.includes("admin");
      const filteredCats = isAdmin ? allCats : allCats.filter((c) => {
        const restricted = catDeptMap[c.id];
        if (!restricted || restricted.length === 0) return true;
        return userDeptId ? restricted.includes(userDeptId) : true;
      });
      const filteredTypes = isAdmin ? allTypes : allTypes.filter((ot) => {
        const restricted = otDeptMap[ot.id];
        if (!restricted || restricted.length === 0) return true;
        return userDeptId ? restricted.includes(userDeptId) : true;
      });

      setCategories(filteredCats);
      setOrderTypes(filteredTypes);

      const rolesData = rolesRes.data ?? [];
      const managerUserIds = new Set(
        rolesData
          .filter((r: any) => r.role === "manager" || r.role === "admin")
          .map((r: any) => r.user_id)
      );
      const filteredManagers = ((profilesRes.data as ProfileOption[]) ?? []).filter(
        (p) => managerUserIds.has(p.user_id)
      );
      setManagers(filteredManagers);

      // Find VD (CEO): profile with no manager_id that has admin role
      const allProfilesList = (allProfilesRes.data as any[]) ?? [];
      const adminUserIds = new Set(
        rolesData.filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
      );
      // Get full profiles with manager_id to find root
      const { data: fullProfiles } = await supabase.from("profiles").select("id, user_id, full_name, manager_id");
      const ceo = (fullProfiles ?? []).find((p: any) => !p.manager_id && adminUserIds.has(p.user_id));
      if (ceo) setCeoProfile({ id: ceo.id, user_id: ceo.user_id, full_name: ceo.full_name });
    };
    if (user) fetchData();
  }, [user, roles]);

  const addItem = () => setItems((prev) => [...prev, { typeId: "" }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const updateItem = (index: number, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { typeId: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.typeId);

    if (!user || validItems.length === 0 || (!isManagerOrAdmin && !approverId)) {
      toast.error("Lägg till minst en utrustning" + (!isManagerOrAdmin ? " och välj godkännare" : ""));
      return;
    }
    if (recipientType === "new" && !recipientName.trim()) {
      toast.error("Ange namn på den nya medarbetaren");
      return;
    }
    if (isOffboarding && !recipientName.trim()) {
      toast.error("Ange namn på medarbetaren som ska offboardas");
      return;
    }

    setSubmitting(true);

    const manager = managers.find((m) => m.id === approverId);
    const firstType = orderTypes.find((t) => t.id === validItems[0].typeId);

    const existingRecipientName = isManagerOrAdmin && recipientType === "existing" && selectedExistingRecipient !== "self"
      ? allProfiles.find(p => p.user_id === selectedExistingRecipient)?.full_name
      : null;

    const baseTitle = validItems.length === 1
      ? firstType?.name ?? "Beställning"
      : `${firstType?.name ?? "Beställning"} + ${validItems.length - 1} till`;

    const title = isOffboarding
      ? `Offboarding – ${recipientName.trim()}`
      : existingRecipientName
        ? `${baseTitle} – ${existingRecipientName}`
        : baseTitle;

    // Determine if this manager/staff needs CEO approval instead of auto-approve
    const isManager = roles.includes("manager");
    const isStaff = myProfile?.is_staff === true;
    const needsCeoApproval = isManagerOrAdmin && (
      (isManager && approvalSettings["approval_managers_to_ceo"] === "true") ||
      (isStaff && approvalSettings["approval_staff_to_ceo"] === "true")
    );

    const autoApprove = isManagerOrAdmin && !needsCeoApproval;
    const resolvedApproverId = needsCeoApproval && ceoProfile
      ? ceoProfile.user_id
      : autoApprove
        ? user.id
        : (manager?.user_id ?? null);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        requester_id: user.id,
        approver_id: resolvedApproverId,
        order_type_id: validItems[0].typeId,
        category_id: firstType?.category_id ?? null,
        title,
        description: description.trim(),
        recipient_type: recipientType,
        recipient_name: recipientType === "new" || isOffboarding
          ? recipientName.trim()
          : isManagerOrAdmin && recipientType === "existing"
            ? (selectedExistingRecipient === "self"
              ? ""
              : (allProfiles.find(p => p.user_id === selectedExistingRecipient)?.full_name ?? ""))
            : "",
        recipient_start_date: recipientType === "new" && recipientStartDate ? recipientStartDate : null,
        recipient_department: (recipientType === "new" || isOffboarding) ? recipientDepartment.trim() : "",
        order_reason: orderReason,
        status: autoApprove ? "approved" : "pending",
        approved_at: autoApprove ? new Date().toISOString() : null,
      } as any)
      .select("id")
      .single();

    if (error || !order) {
      toast.error("Kunde inte skapa beställningen");
      console.error(error);
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

    await supabase.from("order_items").insert(orderItemsToInsert as any);

    const successMsg = isManagerOrAdmin
      ? (isOffboarding ? "Offboarding-ärendet har godkänts och är redo att skickas till extern IT!" : "Beställningen har godkänts automatiskt och är redo att skickas till extern IT!")
      : (isOffboarding ? "Offboarding-ärendet har skickats för godkännande!" : "Beställningen har skickats till din chef för godkännande!");
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

  const renderTypeSelect = (item: OrderItem, index: number) => (
    <Select value={item.typeId} onValueChange={(v) => updateItem(index, v)}>
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
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-up">
        <Card className="glass-card shadow-xl shadow-primary/[0.03]">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-lg md:text-xl">Ny beställning</CardTitle>
            <CardDescription className="text-sm">
              Beställ IT-utrustning för en ny eller befintlig medarbetare. Beställningen skickas till vald chef för attestering.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">

              {/* 1. Recipient type */}
              {isManagerOrAdmin ? (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Beställningen gäller *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientType("existing");
                        setOrderReason("broken_equipment");
                      }}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        recipientType === "existing"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-secondary/30"
                      }`}
                    >
                      <User className={`h-6 w-6 ${recipientType === "existing" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${recipientType === "existing" ? "text-primary" : "text-foreground"}`}>
                        Befintlig medarbetare
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientType("new");
                        setOrderReason("new_employee");
                      }}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        recipientType === "new"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-secondary/30"
                      }`}
                    >
                      <UserPlus className={`h-6 w-6 ${recipientType === "new" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${recipientType === "new" ? "text-primary" : "text-foreground"}`}>
                        Ny medarbetare
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* 1b. Existing employee picker for managers */}
              {isManagerOrAdmin && recipientType === "existing" && !isOffboarding && (
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

              {recipientType === "new" && (
                <div className="space-y-4 rounded-xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Uppgifter om ny medarbetare</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Förnamn *</Label>
                      <Input
                        value={recipientFirstName}
                        onChange={(e) => setRecipientFirstName(e.target.value)}
                        placeholder="Förnamn"
                        className="h-12 md:h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Efternamn *</Label>
                      <Input
                        value={recipientLastName}
                        onChange={(e) => setRecipientLastName(e.target.value)}
                        placeholder="Efternamn"
                        className="h-12 md:h-10"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Startdatum</Label>
                      <Input
                        type="date"
                        value={recipientStartDate}
                        onChange={(e) => setRecipientStartDate(e.target.value)}
                        className="h-12 md:h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Avdelning</Label>
                      <Select value={recipientDepartment} onValueChange={setRecipientDepartment}>
                        <SelectTrigger className="h-12 md:h-10">
                          <SelectValue placeholder="Välj avdelning..." />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentsList.map((d) => (
                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Reason - only for managers/admins */}
              {isManagerOrAdmin && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Orsak *</Label>
                  <RadioGroup value={orderReason} onValueChange={setOrderReason} className="flex flex-wrap gap-2">
                    {activeReasons.map((reason) => (
                      <Label
                        key={reason.value}
                        htmlFor={reason.value}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-all text-sm ${
                          orderReason === reason.value
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <RadioGroupItem value={reason.value} id={reason.value} className="sr-only" />
                        {reason.label}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* 3b. Offboarding details */}
              {isOffboarding && (
                <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-destructive" />
                    <p className="text-xs font-medium text-destructive uppercase tracking-wide">Offboarding – utrustning att återlämna</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Förnamn *</Label>
                      <Input
                        value={recipientFirstName}
                        onChange={(e) => setRecipientFirstName(e.target.value)}
                        placeholder="Förnamn"
                        className="h-12 md:h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Efternamn *</Label>
                      <Input
                        value={recipientLastName}
                        onChange={(e) => setRecipientLastName(e.target.value)}
                        placeholder="Efternamn"
                        className="h-12 md:h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Sista arbetsdag</Label>
                      <Input
                        type="date"
                        value={recipientEndDate}
                        onChange={(e) => setRecipientEndDate(e.target.value)}
                        className="h-12 md:h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Avdelning</Label>
                    <Select value={recipientDepartment} onValueChange={setRecipientDepartment}>
                      <SelectTrigger className="h-12 md:h-10">
                        <SelectValue placeholder="Välj avdelning..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentsList.map((d) => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* 4. Equipment items */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  {isOffboarding ? "Utrustning att återlämna *" : "Utrustning *"}
                </Label>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {renderTypeSelect(item, index)}
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-sm">
                  <Plus className="h-4 w-4" />
                  Lägg till utrustning
                </Button>
              </div>

              {/* 5. Comment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Kommentar</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isOffboarding 
                    ? "T.ex. vilken utrustning som ska samlas in, var den finns..." 
                    : "Ytterligare information, t.ex. speciella behov..."}
                  rows={3}
                  maxLength={1000}
                  className="resize-none"
                />
              </div>

              {/* 6. Approver - only for non-managers */}
              {!isManagerOrAdmin && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Godkännare (närmaste chef) *</Label>
                  <Select value={approverId} onValueChange={setApproverId}>
                    <SelectTrigger className="h-12 md:h-10">
                      <SelectValue placeholder="Välj chef..." />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="py-3 md:py-2">
                          {m.full_name || m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2 h-12 md:h-11 text-base gradient-primary hover:opacity-90 shadow-md shadow-primary/20"
                disabled={submitting}
              >
                <Send className="h-4 w-4" />
                {submitting ? "Skickar..." : isOffboarding ? "Skicka offboarding-ärende" : "Skicka beställning"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
