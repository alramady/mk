import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Building2, MapPin, Plus, Pencil, Trash2, Search,
  ArrowLeft, ToggleLeft, ToggleRight, Globe, Map
} from "lucide-react";

export default function CityDistrictManagement() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  // ─── State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("cities");
  const [citySearch, setCitySearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [selectedCityFilter, setSelectedCityFilter] = useState("all");
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [editingCity, setEditingCity] = useState<any>(null);
  const [editingDistrict, setEditingDistrict] = useState<any>(null);
  const [deletingCity, setDeletingCity] = useState<any>(null);
  const [deletingDistrict, setDeletingDistrict] = useState<any>(null);

  // City form
  const [cityForm, setCityForm] = useState({
    nameAr: "", nameEn: "", region: "", regionAr: "",
    latitude: "", longitude: "", imageUrl: "", sortOrder: 0, isActive: true,
  });

  // District form
  const [districtForm, setDistrictForm] = useState({
    cityId: 0, city: "", cityAr: "", nameAr: "", nameEn: "",
    latitude: "", longitude: "", sortOrder: 0, isActive: true,
  });

  // ─── Queries ────────────────────────────────────────────────
  const citiesQuery = trpc.cities.all.useQuery({ activeOnly: false });
  const districtsQuery = trpc.districts.all.useQuery({ activeOnly: false });
  const utils = trpc.useUtils();

  // ─── Mutations ──────────────────────────────────────────────
  const createCity = trpc.cities.create.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.cityCreated"));
      utils.cities.all.invalidate();
      setShowCityDialog(false);
      resetCityForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCity = trpc.cities.update.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.cityUpdated"));
      utils.cities.all.invalidate();
      setShowCityDialog(false);
      setEditingCity(null);
      resetCityForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleCity = trpc.cities.toggle.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.cityToggled"));
      utils.cities.all.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCity = trpc.cities.delete.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.cityDeleted"));
      utils.cities.all.invalidate();
      utils.districts.all.invalidate();
      setDeletingCity(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const createDistrict = trpc.districts.create.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.districtCreated"));
      utils.districts.all.invalidate();
      setShowDistrictDialog(false);
      resetDistrictForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDistrict = trpc.districts.update.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.districtUpdated"));
      utils.districts.all.invalidate();
      setShowDistrictDialog(false);
      setEditingDistrict(null);
      resetDistrictForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleDistrict = trpc.districts.toggle.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.districtToggled"));
      utils.districts.all.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDistrict = trpc.districts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("cityMgmt.districtDeleted"));
      utils.districts.all.invalidate();
      setDeletingDistrict(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Helpers ────────────────────────────────────────────────
  const resetCityForm = () => setCityForm({
    nameAr: "", nameEn: "", region: "", regionAr: "",
    latitude: "", longitude: "", imageUrl: "", sortOrder: 0, isActive: true,
  });

  const resetDistrictForm = () => setDistrictForm({
    cityId: 0, city: "", cityAr: "", nameAr: "", nameEn: "",
    latitude: "", longitude: "", sortOrder: 0, isActive: true,
  });

  const openEditCity = (city: any) => {
    setEditingCity(city);
    setCityForm({
      nameAr: city.nameAr || "", nameEn: city.nameEn || "",
      region: city.region || "", regionAr: city.regionAr || "",
      latitude: city.latitude || "", longitude: city.longitude || "",
      imageUrl: city.imageUrl || "", sortOrder: city.sortOrder || 0,
      isActive: city.isActive ?? true,
    });
    setShowCityDialog(true);
  };

  const openEditDistrict = (district: any) => {
    setEditingDistrict(district);
    setDistrictForm({
      cityId: district.cityId || 0, city: district.city || "",
      cityAr: district.cityAr || "", nameAr: district.nameAr || "",
      nameEn: district.nameEn || "", latitude: district.latitude || "",
      longitude: district.longitude || "", sortOrder: district.sortOrder || 0,
      isActive: district.isActive ?? true,
    });
    setShowDistrictDialog(true);
  };

  const openAddDistrict = () => {
    resetDistrictForm();
    // Pre-fill city if a filter is selected
    if (selectedCityFilter !== "all") {
      const city = cities.find((c: any) => String(c.id) === selectedCityFilter);
      if (city) {
        setDistrictForm(prev => ({
          ...prev,
          cityId: city.id,
          city: city.nameEn,
          cityAr: city.nameAr,
        }));
      }
    }
    setEditingDistrict(null);
    setShowDistrictDialog(true);
  };

  const handleSaveCity = () => {
    if (!cityForm.nameAr || !cityForm.nameEn) {
      toast.error(isAr ? "يرجى إدخال اسم المدينة بالعربي والإنجليزي" : "Please enter city name in Arabic and English");
      return;
    }
    if (editingCity) {
      updateCity.mutate({ id: editingCity.id, ...cityForm });
    } else {
      createCity.mutate(cityForm);
    }
  };

  const handleSaveDistrict = () => {
    if (!districtForm.nameAr || !districtForm.nameEn || !districtForm.city) {
      toast.error(isAr ? "يرجى إدخال جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    if (editingDistrict) {
      updateDistrict.mutate({ id: editingDistrict.id, ...districtForm });
    } else {
      createDistrict.mutate(districtForm);
    }
  };

  // ─── Filtered data ─────────────────────────────────────────
  const cities = citiesQuery.data || [];
  const allDistricts = districtsQuery.data || [];

  const filteredCities = useMemo(() => {
    if (!citySearch) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter((c: any) =>
      c.nameAr?.toLowerCase().includes(q) ||
      c.nameEn?.toLowerCase().includes(q) ||
      c.region?.toLowerCase().includes(q)
    );
  }, [cities, citySearch]);

  const filteredDistricts = useMemo(() => {
    let result = allDistricts;
    if (selectedCityFilter !== "all") {
      result = result.filter((d: any) => String(d.cityId) === selectedCityFilter || d.city === selectedCityFilter);
    }
    if (districtSearch) {
      const q = districtSearch.toLowerCase();
      result = result.filter((d: any) =>
        d.nameAr?.toLowerCase().includes(q) ||
        d.nameEn?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allDistricts, selectedCityFilter, districtSearch]);

  const activeCities = cities.filter((c: any) => c.isActive).length;
  const activeDistricts = allDistricts.filter((d: any) => d.isActive).length;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{isAr ? "غير مصرح" : "Unauthorized"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className={`h-5 w-5 ${isAr ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{t("cityMgmt.title")}</h1>
              <p className="text-muted-foreground">{t("cityMgmt.subtitle")}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("cityMgmt.totalCities")}</p>
                  <p className="text-xl font-bold">{cities.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <ToggleRight className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("cityMgmt.activeCities")}</p>
                  <p className="text-xl font-bold">{activeCities}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MapPin className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("cityMgmt.totalDistricts")}</p>
                  <p className="text-xl font-bold">{allDistricts.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Globe className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("cityMgmt.activeDistricts")}</p>
                  <p className="text-xl font-bold">{activeDistricts}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="cities" className="gap-2">
              <Building2 className="h-4 w-4" />
              {t("cityMgmt.citiesTab")} ({cities.length})
            </TabsTrigger>
            <TabsTrigger value="districts" className="gap-2">
              <MapPin className="h-4 w-4" />
              {t("cityMgmt.districtsTab")} ({allDistricts.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Cities Tab ──────────────────────────────────────── */}
          <TabsContent value="cities">
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isAr ? "right-3" : "left-3"}`} />
                <Input
                  placeholder={t("cityMgmt.search")}
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className={isAr ? "pr-10" : "pl-10"}
                />
              </div>
              <Button onClick={() => { resetCityForm(); setEditingCity(null); setShowCityDialog(true); }}>
                <Plus className="h-4 w-4" />
                {t("cityMgmt.addCity")}
              </Button>
            </div>

            {filteredCities.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("cityMgmt.noCities")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredCities.map((city: any) => {
                  const cityDistricts = allDistricts.filter((d: any) => d.cityId === city.id || d.city === city.nameEn);
                  return (
                    <Card key={city.id} className={`transition-all ${!city.isActive ? "opacity-60" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            {city.imageUrl ? (
                              <img src={city.imageUrl} alt={isAr ? city.nameAr : city.nameEn} className="w-16 h-16 rounded-lg object-cover" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                                <Map className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{isAr ? city.nameAr : city.nameEn}</h3>
                                <Badge variant={city.isActive ? "default" : "secondary"}>
                                  {city.isActive ? t("cityMgmt.active") : t("cityMgmt.inactive")}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {isAr ? city.nameEn : city.nameAr}
                                {city.region && ` • ${isAr ? city.regionAr || city.region : city.region}`}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {cityDistricts.length} {isAr ? "حي" : "districts"}
                                {city.latitude && ` • ${city.latitude}, ${city.longitude}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={city.isActive}
                              onCheckedChange={(checked) => toggleCity.mutate({ id: city.id, isActive: checked })}
                            />
                            <Button variant="ghost" size="icon" onClick={() => openEditCity(city)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingCity(city)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Districts Tab ───────────────────────────────────── */}
          <TabsContent value="districts">
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
              <div className="flex gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isAr ? "right-3" : "left-3"}`} />
                  <Input
                    placeholder={t("cityMgmt.search")}
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    className={isAr ? "pr-10" : "pl-10"}
                  />
                </div>
                <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t("cityMgmt.selectCity")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("cityMgmt.allDistricts")}</SelectItem>
                    {cities.map((city: any) => (
                      <SelectItem key={city.id} value={String(city.id)}>
                        {isAr ? city.nameAr : city.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={openAddDistrict}>
                <Plus className="h-4 w-4" />
                {t("cityMgmt.addDistrict")}
              </Button>
            </div>

            {filteredDistricts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("cityMgmt.noDistricts")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg">
                  <div className="col-span-3">{t("cityMgmt.nameAr")}</div>
                  <div className="col-span-3">{t("cityMgmt.nameEn")}</div>
                  <div className="col-span-2">{t("cityMgmt.belongsToCity")}</div>
                  <div className="col-span-2">{t("cityMgmt.status")}</div>
                  <div className="col-span-2 text-center">{t("cityMgmt.actions")}</div>
                </div>
                {filteredDistricts.map((district: any) => (
                  <div
                    key={district.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 bg-card rounded-lg border items-center transition-all ${!district.isActive ? "opacity-60" : ""}`}
                  >
                    <div className="col-span-3 font-medium">{district.nameAr}</div>
                    <div className="col-span-3 text-muted-foreground">{district.nameEn}</div>
                    <div className="col-span-2">
                      <Badge variant="outline">{isAr ? district.cityAr : district.city}</Badge>
                    </div>
                    <div className="col-span-2">
                      <Switch
                        checked={district.isActive}
                        onCheckedChange={(checked) => toggleDistrict.mutate({ id: district.id, isActive: checked })}
                      />
                    </div>
                    <div className="col-span-2 flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDistrict(district)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingDistrict(district)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-center pt-2">
                  {isAr ? `عرض ${filteredDistricts.length} من ${allDistricts.length} حي` : `Showing ${filteredDistricts.length} of ${allDistricts.length} districts`}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── City Dialog ──────────────────────────────────────── */}
      <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
        <DialogContent className="max-w-lg" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingCity ? t("cityMgmt.editCity") : t("cityMgmt.addCity")}</DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل بيانات المدينة بالعربي والإنجليزي" : "Enter city details in Arabic and English"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.nameAr")}</Label>
                <Input
                  value={cityForm.nameAr}
                  onChange={(e) => setCityForm(p => ({ ...p, nameAr: e.target.value }))}
                  dir="rtl"
                  placeholder="الرياض"
                />
              </div>
              <div>
                <Label>{t("cityMgmt.nameEn")}</Label>
                <Input
                  value={cityForm.nameEn}
                  onChange={(e) => setCityForm(p => ({ ...p, nameEn: e.target.value }))}
                  dir="ltr"
                  placeholder="Riyadh"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.regionAr")}</Label>
                <Input
                  value={cityForm.regionAr}
                  onChange={(e) => setCityForm(p => ({ ...p, regionAr: e.target.value }))}
                  dir="rtl"
                  placeholder="منطقة الرياض"
                />
              </div>
              <div>
                <Label>{t("cityMgmt.region")}</Label>
                <Input
                  value={cityForm.region}
                  onChange={(e) => setCityForm(p => ({ ...p, region: e.target.value }))}
                  dir="ltr"
                  placeholder="Riyadh Region"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.latitude")}</Label>
                <Input
                  value={cityForm.latitude}
                  onChange={(e) => setCityForm(p => ({ ...p, latitude: e.target.value }))}
                  dir="ltr"
                  placeholder="24.7136"
                />
              </div>
              <div>
                <Label>{t("cityMgmt.longitude")}</Label>
                <Input
                  value={cityForm.longitude}
                  onChange={(e) => setCityForm(p => ({ ...p, longitude: e.target.value }))}
                  dir="ltr"
                  placeholder="46.6753"
                />
              </div>
            </div>
            <div>
              <Label>{t("cityMgmt.imageUrl")}</Label>
              <Input
                value={cityForm.imageUrl}
                onChange={(e) => setCityForm(p => ({ ...p, imageUrl: e.target.value }))}
                dir="ltr"
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.sortOrder")}</Label>
                <Input
                  type="number"
                  value={cityForm.sortOrder}
                  onChange={(e) => setCityForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={cityForm.isActive}
                  onCheckedChange={(checked) => setCityForm(p => ({ ...p, isActive: checked }))}
                />
                <Label>{cityForm.isActive ? t("cityMgmt.active") : t("cityMgmt.inactive")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCityDialog(false)}>
              {t("cityMgmt.cancel")}
            </Button>
            <Button onClick={handleSaveCity} disabled={createCity.isPending || updateCity.isPending}>
              {t("cityMgmt.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── District Dialog ──────────────────────────────────── */}
      <Dialog open={showDistrictDialog} onOpenChange={setShowDistrictDialog}>
        <DialogContent className="max-w-lg" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingDistrict ? t("cityMgmt.editDistrict") : t("cityMgmt.addDistrict")}</DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل بيانات الحي بالعربي والإنجليزي" : "Enter district details in Arabic and English"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("cityMgmt.belongsToCity")}</Label>
              <Select
                value={districtForm.cityId ? String(districtForm.cityId) : ""}
                onValueChange={(val) => {
                  const city = cities.find((c: any) => String(c.id) === val);
                  if (city) {
                    setDistrictForm(p => ({
                      ...p,
                      cityId: city.id,
                      city: city.nameEn,
                      cityAr: city.nameAr,
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("cityMgmt.selectCity")} />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city: any) => (
                    <SelectItem key={city.id} value={String(city.id)}>
                      {isAr ? city.nameAr : city.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.nameAr")}</Label>
                <Input
                  value={districtForm.nameAr}
                  onChange={(e) => setDistrictForm(p => ({ ...p, nameAr: e.target.value }))}
                  dir="rtl"
                  placeholder="النخيل"
                />
              </div>
              <div>
                <Label>{t("cityMgmt.nameEn")}</Label>
                <Input
                  value={districtForm.nameEn}
                  onChange={(e) => setDistrictForm(p => ({ ...p, nameEn: e.target.value }))}
                  dir="ltr"
                  placeholder="Al Nakheel"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.latitude")}</Label>
                <Input
                  value={districtForm.latitude}
                  onChange={(e) => setDistrictForm(p => ({ ...p, latitude: e.target.value }))}
                  dir="ltr"
                  placeholder="24.7136"
                />
              </div>
              <div>
                <Label>{t("cityMgmt.longitude")}</Label>
                <Input
                  value={districtForm.longitude}
                  onChange={(e) => setDistrictForm(p => ({ ...p, longitude: e.target.value }))}
                  dir="ltr"
                  placeholder="46.6753"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("cityMgmt.sortOrder")}</Label>
                <Input
                  type="number"
                  value={districtForm.sortOrder}
                  onChange={(e) => setDistrictForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={districtForm.isActive}
                  onCheckedChange={(checked) => setDistrictForm(p => ({ ...p, isActive: checked }))}
                />
                <Label>{districtForm.isActive ? t("cityMgmt.active") : t("cityMgmt.inactive")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistrictDialog(false)}>
              {t("cityMgmt.cancel")}
            </Button>
            <Button onClick={handleSaveDistrict} disabled={createDistrict.isPending || updateDistrict.isPending}>
              {t("cityMgmt.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete City Confirm ──────────────────────────────── */}
      <AlertDialog open={!!deletingCity} onOpenChange={() => setDeletingCity(null)}>
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cityMgmt.deleteCity")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cityMgmt.deleteCityConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cityMgmt.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingCity && deleteCity.mutate({ id: deletingCity.id })}
            >
              {t("cityMgmt.deleteCity")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete District Confirm ──────────────────────────── */}
      <AlertDialog open={!!deletingDistrict} onOpenChange={() => setDeletingDistrict(null)}>
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cityMgmt.deleteDistrict")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cityMgmt.deleteDistrictConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cityMgmt.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingDistrict && deleteDistrict.mutate({ id: deletingDistrict.id })}
            >
              {t("cityMgmt.deleteDistrict")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
