import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Plus, Trash2, UserPlus, LogOut, Monitor } from "lucide-react";
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

interface SystemOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export default function Onboarding() {
  const { user, roles } = useAuth();
  const isManagerOrAdmin = roles.includes("manager") || roles.includes("admin");
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileOption[]>([]);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);
  const [approvalSettings, setApprovalSettings] = useState<Record<string, string>>({});
  const [myProfile, setMyProfile] = useState<{ is_staff: boolean | null; manager_id: string | null } | null>(null);
  const [ceoProfile, setCeoProfile] = useState<ProfileOption | null>(null);
  const [myManagerProfile, setMyManagerProfile] = useState<ProfileOption | null>(null);
  const [managers, setManagers] = useState<ProfileOption[]>([]);

  // Flow type: onboarding or offboarding
  const [flowType, setFlowType] = useState<"onboarding" | "offboarding">("onboarding");
  const isOffboarding = flowType === "offboarding";

  // Form state
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const recipientName = `${recipientFirstName} ${recipientLastName}`.trim();
  const [recipientStartDate, setRecipientStartDate] = useState("");
  const [recipientEndDate, setRecipientEndDate] = useState("");
  const [recipientDepartment, setRecipientDepartment] = useState("");
  const [items, setItems] = useState<OrderItem[]>([{ typeId: "" }]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [approverId, setApproverId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Approval logic
  const isManager = roles.includes("manager");
  const isStaff = myProfile?.is_staff === true;
  const reportsDirectlyToCeo = !myProfile?.manager_id || (ceoProfile && myProfile?.manager_id === ceoProfile?.id);
  const needsCeoApprovalCheck = isManagerOrAdmin && reportsDirectlyToCeo && (
    (isManager && approvalSettings["approval_managers_to_ceo"] === "true") ||
    (isStaff && approvalSettings["approval_staff_to_ceo"] === "true")
  );
  const needsManagerApproval = isManagerOrAdmin && !reportsDirectlyToCeo && myManagerProfile != null;
  const needsApproval = needsCeoApprovalCheck || needsManagerApproval;
  const showApproverPicker = !isManagerOrAdmin || needsApproval;

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

      if (myProfileRes.data) {
        setMyProfile({ is_staff: (myProfileRes.data as any).is_staff, manager_id: (myProfileRes.data as any).manager_id });
      }

      const aMap: Record<string, string> = {};
      for (const s of (approvalRes.data as any[]) ?? []) aMap[s.setting_key] = s.setting_value;
      setApprovalSettings(aMap);

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

      const userDept = (myProfileRes.data as any)?.department ?? "";
      const { data: deptRows } = await supabase.from("departments").select("id, name").order("name");
      setDepartmentsList((deptRows as any[]) ?? []);
      const userDeptId = (deptRows ?? []).find((d: any) => d.name === userDept)?.id;

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
        rolesData.filter((r: any) => r.role === "manager" || r.role === "admin").map((r: any) => r.user_id)
      );
      const filteredManagers = ((profilesRes.data as ProfileOption[]) ?? []).filter(
        (p) => managerUserIds.has(p.user_id)
      );
      setManagers(filteredManagers);

      const adminUserIds = new Set(
        rolesData.filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
      );
      const { data: fullProfiles } = await supabase.from("profiles").select("id, user_id, full_name, manager_id");
      const ceo = (fullProfiles ?? []).find((p: any) => !p.manager_id && adminUserIds.has(p.user_id));
      if (ceo) setCeoProfile({ id: ceo.id, user_id: ceo.user_id, full_name: ceo.full_name });

      const myMgrId = (myProfileRes.data as any)?.manager_id;
      if (myMgrId) {
        const mgrProfile = (fullProfiles ?? []).find((p: any) => p.id === myMgrId);
        if (mgrProfile) setMyManagerProfile({ id: mgrProfile.id, user_id: mgrProfile.user_id, full_name: mgrProfile.full_name });
      }
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

    if (!user || validItems.length === 0) {
      toast.error("Lägg till minst en utrustning");
      return;
    }
    if (!recipientName.trim()) {
      toast.error(isOffboarding ? "Ange namn på medarbetaren" : "Ange namn på den nya medarbetaren");
      return;
    }

    setSubmitting(true);

    const manager = managers.find((m) => m.id === approverId);
    const firstType = orderTypes.find((t) => t.id === validItems[0].typeId);

    const title = isOffboarding
      ? `Offboarding – ${recipientName.trim()}`
      : `Onboarding – ${recipientName.trim()}`;

    const rdtc = !myProfile?.manager_id || (ceoProfile && myProfile?.manager_id === ceoProfile?.id);
    const needsCeoApproval = isManagerOrAdmin && rdtc && (
      (roles.includes("manager") && approvalSettings["approval_managers_to_ceo"] === "true") ||
      (myProfile?.is_staff === true && approvalSettings["approval_staff_to_ceo"] === "true")
    );
    const needsMgrApproval = isManagerOrAdmin && !rdtc && myManagerProfile != null;

    const autoApprove = isManagerOrAdmin && !needsCeoApproval && !needsMgrApproval;
    const resolvedApproverId = needsCeoApproval && ceoProfile
      ? ceoProfile.user_id
      : needsMgrApproval && myManagerProfile
        ? myManagerProfile.user_id
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
        recipient_type: isOffboarding ? "existing" : "new",
        recipient_name: recipientName.trim(),
        recipient_start_date: !isOffboarding && recipientStartDate ? recipientStartDate : null,
        recipient_department: recipientDepartment.trim(),
        order_reason: isOffboarding ? "end_of_employment" : "new_employee",
        status: autoApprove ? "approved" : "pending",
        approved_at: autoApprove ? new Date().toISOString() : null,
      } as any)
      .select("id")
      .single();

    if (error || !order) {
      toast.error("Kunde inte skapa ärendet");
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

    const successMsg = autoApprove
      ? `${isOffboarding ? "Offboarding" : "Onboarding"}-ärendet har godkänts automatiskt!`
      : needsCeoApproval
        ? `${isOffboarding ? "Offboarding" : "Onboarding"}-ärendet har skickats till VD för attestering!`
        : needsMgrApproval
          ? `${isOffboarding ? "Offboarding" : "Onboarding"}-ärendet har skickats till din chef för attestering!`
          : `${isOffboarding ? "Offboarding" : "Onboarding"}-ärendet har skickats för godkännande!`;
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

  // Only managers/admins should access this page
  if (!isManagerOrAdmin) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-up">
        <Card className="glass-card shadow-xl shadow-primary/[0.03]">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Du behöver vara chef eller admin för att använda on-/offboarding.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <Card className="glass-card shadow-xl shadow-primary/[0.03]">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="font-heading text-lg md:text-xl">
            {isOffboarding ? "Offboarding" : "Onboarding"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isOffboarding
              ? "Hantera avslut av anställning – samla in utrustning och avsluta konton."
              : "Förbered utrustning och konton för en ny medarbetare."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">

            {/* Flow type selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Typ av ärende *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFlowType("onboarding")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    flowType === "onboarding"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:bg-secondary/30"
                  }`}
                >
                  <UserPlus className={`h-6 w-6 ${flowType === "onboarding" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${flowType === "onboarding" ? "text-primary" : "text-foreground"}`}>
                    Onboarding
                  </span>
                  <span className="text-xs text-muted-foreground">Ny medarbetare</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlowType("offboarding")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    flowType === "offboarding"
                      ? "border-destructive bg-destructive/5 shadow-sm"
                      : "border-border hover:border-destructive/30 hover:bg-secondary/30"
                  }`}
                >
                  <LogOut className={`h-6 w-6 ${flowType === "offboarding" ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${flowType === "offboarding" ? "text-destructive" : "text-foreground"}`}>
                    Offboarding
                  </span>
                  <span className="text-xs text-muted-foreground">Avslut av anställning</span>
                </button>
              </div>
            </div>

            {/* Onboarding details */}
            {!isOffboarding && (
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
                {recipientFirstName && recipientLastName && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Förslag på e-post:</span>
                    <span className="text-sm font-medium text-primary">
                      {recipientFirstName.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[åä]/gi, 'a').replace(/[ö]/gi, 'o').replace(/[é]/gi, 'e')}.{recipientLastName.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[åä]/gi, 'a').replace(/[ö]/gi, 'o').replace(/[é]/gi, 'e')}@handelsfastigheter.se
                    </span>
                  </div>
                )}
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

            {/* Offboarding details */}
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

            {/* Equipment items */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                {isOffboarding ? "Utrustning att återlämna *" : "Utrustning att beställa *"}
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

            {/* Comment */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Kommentar</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isOffboarding
                  ? "T.ex. vilken utrustning som ska samlas in, var den finns..."
                  : "T.ex. speciella behov, programvaror som behövs..."}
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
            </div>

            {/* Approver */}
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
              className={`w-full gap-2 h-12 md:h-11 text-base shadow-md ${
                isOffboarding
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/20"
                  : "gradient-primary hover:opacity-90 shadow-primary/20"
              }`}
              disabled={submitting}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Skickar..." : isOffboarding ? "Skicka offboarding-ärende" : "Skicka onboarding-ärende"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
