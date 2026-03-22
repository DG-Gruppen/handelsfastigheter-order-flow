import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";
import { useRegions } from "@/hooks/useRegions";
import { sendHelpdeskEmail } from "@/lib/sendHelpdeskEmail";
import { sendNewOrderEmailToApprover, buildApprovalEmailHtml } from "@/lib/orderEmails";
import { enqueueEmail } from "@/lib/enqueueEmail";
import { getAppBaseUrl } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Plus, Trash2, UserPlus, LogOut, Monitor, Search } from "lucide-react";
import { getIcon } from "@/lib/icons";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  manager_id?: string | null;
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
  const { canEdit: canEditOnboarding } = useModulePermission("onboarding");
  const isManagerOrAdmin = roles.includes("manager") || roles.includes("admin") || canEditOnboarding;
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileOption[]>([]);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);
  const [approvalSettings, setApprovalSettings] = useState<Record<string, string>>({});
  const [myProfile, setMyProfile] = useState<{ id: string; is_staff: boolean | null; manager_id: string | null; department: string | null } | null>(null);
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
  const [recipientRegionId, setRecipientRegionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profileSearchOpen, setProfileSearchOpen] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const { regions } = useRegions();

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
      const [catsRes, typesRes, profilesRes, allProfilesRes, rolesRes, myProfileRes, catDeptsRes, otDeptsRes, approvalRes, systemsRes] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("order_types").select("*").eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, user_id, full_name").neq("user_id", user?.id ?? ""),
        supabase.from("profiles").select("id, user_id, full_name, manager_id").order("full_name"),
        supabase.rpc("get_all_user_roles"),
        supabase.from("profiles").select("id, department, is_staff, manager_id, user_id").eq("user_id", user?.id ?? "").single(),
        supabase.from("category_departments").select("category_id, department_id"),
        supabase.from("order_type_departments").select("order_type_id, department_id"),
        supabase.from("org_chart_settings").select("setting_key, setting_value").in("setting_key", ["approval_managers_to_ceo", "approval_staff_to_ceo"]),
        supabase.from("systems").select("id, name, description, icon").eq("is_active", true).order("sort_order"),
      ]);

      setSystems((systemsRes.data as SystemOption[]) ?? []);

      const allCats = (catsRes.data as Category[]) ?? [];
      const allTypes = (typesRes.data as OrderType[]) ?? [];
      setAllProfiles((allProfilesRes.data as ProfileOption[]) ?? []);

      if (myProfileRes.data) {
        const mp = myProfileRes.data as any;
        setMyProfile({ id: mp.id, is_staff: mp.is_staff, manager_id: mp.manager_id, department: mp.department });
        // For non-admin managers: pre-fill department
        if (!roles.includes("admin") && mp.department) {
          setRecipientDepartment(mp.department);
        }
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

  // Lookup profile + previous onboarding data for offboarding
  const handleSelectProfile = async (profile: ProfileOption) => {
    setSelectedProfileId(profile.id);
    setProfileSearchOpen(false);
    setLoadingProfile(true);

    // Fill from profile
    const nameParts = profile.full_name.split(" ");
    setRecipientFirstName(nameParts[0] || "");
    setRecipientLastName(nameParts.slice(1).join(" ") || "");

    // Get full profile for department
    const { data: fullProfile } = await supabase
      .from("profiles")
      .select("department")
      .eq("id", profile.id)
      .single();
    if (fullProfile?.department) setRecipientDepartment(fullProfile.department);

    // Look for previous onboarding order for this person
    const { data: prevOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("recipient_name", profile.full_name)
      .eq("recipient_type", "new")
      .order("created_at", { ascending: false })
      .limit(1);

    if (prevOrders && prevOrders.length > 0) {
      const prevOrderId = prevOrders[0].id;

      // Fetch equipment items and systems from that order
      const [itemsRes, systemsRes] = await Promise.all([
        supabase.from("order_items").select("order_type_id").eq("order_id", prevOrderId),
        supabase.from("order_systems").select("system_id").eq("order_id", prevOrderId),
      ]);

      const prevItems = (itemsRes.data ?? [])
        .filter((i: any) => i.order_type_id)
        .map((i: any) => ({ typeId: i.order_type_id }));
      if (prevItems.length > 0) setItems(prevItems);

      const prevSystemIds = (systemsRes.data ?? []).map((s: any) => s.system_id);
      if (prevSystemIds.length > 0) setSelectedSystems(prevSystemIds);

      toast.info("Uppgifter hämtade från tidigare onboarding");
    } else {
      toast.info("Profiluppgifter ifyllda – ingen tidigare onboarding hittades");
    }

    setLoadingProfile(false);
  };

  // For offboarding: non-admins only see their subordinates
  const isAdmin = roles.includes("admin");

  const getSubordinateIds = (profileId: string, profiles: ProfileOption[]): Set<string> => {
    const result = new Set<string>();
    const findChildren = (parentId: string) => {
      for (const p of profiles) {
        if ((p as any).manager_id === parentId && !result.has(p.id)) {
          result.add(p.id);
          findChildren(p.id);
        }
      }
    };
    findChildren(profileId);
    return result;
  };

  const filteredSearchProfiles = allProfiles.filter((p) => {
    // For non-admins in offboarding, only show subordinates
    if (isOffboarding && !isAdmin && myProfile?.id) {
      const subordinateIds = getSubordinateIds(myProfile.id, allProfiles);
      if (!subordinateIds.has(p.id)) return false;
    }
    if (!profileSearchQuery) return true;
    return p.full_name.toLowerCase().includes(profileSearchQuery.toLowerCase());
  });

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

    // Save selected systems/licenses
    if (selectedSystems.length > 0) {
      const systemRows = selectedSystems.map((systemId) => ({
        order_id: order.id,
        system_id: systemId,
      }));
      await supabase.from("order_systems").insert(systemRows as any);
    }

    // Create profile for new employee (onboarding only)
    if (!isOffboarding && recipientName.trim()) {
      const normalize = (s: string) =>
        s.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[åä]/gi, 'a').replace(/[ö]/gi, 'o').replace(/[é]/gi, 'e');
      const suggestedEmail = `${normalize(recipientFirstName)}.${normalize(recipientLastName)}@handelsfastigheter.se`;

      // Check if profile with this email already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", suggestedEmail)
        .maybeSingle();

      if (!existingProfile) {
        // Create a placeholder profile – handle_new_user trigger will link it when they sign in
        const placeholderUserId = crypto.randomUUID();
        await supabase.from("profiles").insert({
          user_id: placeholderUserId,
          full_name: recipientName.trim(),
          email: suggestedEmail,
          department: recipientDepartment.trim() || null,
          start_date: recipientStartDate || null,
        } as any);
      }
    }

    // Notification + email to approver (if not auto-approved)
    if (!autoApprove && resolvedApproverId && resolvedApproverId !== user.id) {
      const requesterName2 = allProfiles.find(p => p.user_id === user.id)?.full_name || "Någon";
      await supabase.rpc("create_notification", {
        _user_id: resolvedApproverId,
        _title: "Ny beställning att attestera",
        _message: `${requesterName2} har skickat en beställning: ${title}`,
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
            requesterName: requesterName2,
            approverName: approverProfileData.full_name,
            approverEmail: approverEmailData.email,
            items: orderItemsToInsert.map((i) => ({ name: i.name, description: i.description, quantity: i.quantity })),
            recipientName: recipientName.trim(),
          });
        }
      }
    }

    // Send helpdesk email + confirmation for auto-approved orders
    if (autoApprove) {
      const requesterProfile = allProfiles.find(p => p.user_id === user.id);
      const { data: reqEmail } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      // Fetch system names for the email
      const selectedSystemDetails = systems
        .filter((s) => selectedSystems.includes(s.id))
        .map((s) => ({ name: s.name, description: s.description }));

      await sendHelpdeskEmail({
        orderId: order.id,
        title,
        description: description.trim(),
        recipientName: recipientName.trim(),
        recipientDepartment: recipientDepartment.trim(),
        recipientStartDate: isOffboarding ? recipientEndDate : recipientStartDate,
        orderReason: isOffboarding ? "end_of_employment" : "new_employee",
        requesterName: requesterProfile?.full_name || "Okänd",
        requesterEmail: reqEmail?.email || "",
        items: orderItemsToInsert.map((i) => ({ name: i.name, description: i.description, quantity: i.quantity })),
        systems: selectedSystemDetails,
      });

      // Send confirmation email to requester (auto-approved)
      if (reqEmail?.email) {
        const orderUrl = `${getAppBaseUrl()}/orders/${order.id}`;
        const confirmHtml = buildApprovalEmailHtml({
          recipientName: requesterProfile?.full_name || "du",
          title,
          items: orderItemsToInsert.map((i) => ({ name: i.name, quantity: 1 })),
          orderUrl,
          isAutoApproved: true,
        });
        try {
          await enqueueEmail({
            to: reqEmail.email,
            subject: `[SHF IT] Din beställning har godkänts: ${title}`,
            html: confirmHtml,
          });
        } catch (err) {
          console.error("Failed to enqueue approval confirmation email:", err);
        }
      }
    }

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
                  onClick={() => { setFlowType("onboarding"); setSelectedProfileId(null); setProfileSearchQuery(""); }}
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
                  onClick={() => { setFlowType("offboarding"); setRecipientFirstName(""); setRecipientLastName(""); setRecipientDepartment(""); setItems([{ typeId: "" }]); setSelectedSystems([]); }}
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
                    {!isAdmin && myProfile?.department ? (
                      <Input
                        value={recipientDepartment}
                        disabled
                        className="h-12 md:h-10 bg-muted/50"
                      />
                    ) : (
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
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Region *</Label>
                  <Select value={recipientRegionId} onValueChange={setRecipientRegionId}>
                    <SelectTrigger className="h-12 md:h-10">
                      <SelectValue placeholder="Välj region..." />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Offboarding details */}
            {isOffboarding && (
              <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-destructive" />
                  <p className="text-xs font-medium text-destructive uppercase tracking-wide">Offboarding – medarbetare</p>
                </div>

                {/* Profile search */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sök medarbetare</Label>
                  <Popover open={profileSearchOpen} onOpenChange={setProfileSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start h-12 md:h-10 font-normal"
                      >
                        <Search className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                        {selectedProfileId
                          ? allProfiles.find((p) => p.id === selectedProfileId)?.full_name || "Vald medarbetare"
                          : "Sök på namn..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Sök medarbetare..."
                          value={profileSearchQuery}
                          onValueChange={setProfileSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>Ingen medarbetare hittades</CommandEmpty>
                          {filteredSearchProfiles.slice(0, 20).map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.full_name}
                              onSelect={() => handleSelectProfile(p)}
                              className="py-3 md:py-2"
                            >
                              {p.full_name}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {loadingProfile && (
                    <p className="text-xs text-muted-foreground animate-pulse">Hämtar uppgifter...</p>
                  )}
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
                    {!isAdmin && myProfile?.department ? (
                      <Input
                        value={recipientDepartment}
                        disabled
                        className="h-12 md:h-10 bg-muted/50"
                      />
                    ) : (
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
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Region *</Label>
                  <Select value={recipientRegionId} onValueChange={setRecipientRegionId}>
                    <SelectTrigger className="h-12 md:h-10">
                      <SelectValue placeholder="Välj region..." />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            {/* Systems & licenses */}
            {systems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">
                    {isOffboarding ? "System & licenser att avsluta" : "System & licenser att aktivera"}
                  </Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {systems.map((sys) => {
                    const SysIcon = getIcon(sys.icon);
                    const checked = selectedSystems.includes(sys.id);
                    return (
                      <label
                        key={sys.id}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                          checked
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/20 hover:bg-secondary/30"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedSystems((prev) =>
                              v ? [...prev, sys.id] : prev.filter((id) => id !== sys.id)
                            );
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <SysIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{sys.name}</span>
                          </div>
                          {sys.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{sys.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

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
