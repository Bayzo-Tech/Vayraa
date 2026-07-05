"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { MapPin, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface AreaGroup {
  name: string;
  beaches: { id: string; name: string; zones: { name: string; minDistance: number; maxDistance: number; fee: number }[] }[];
}

export default function AreaSelectionPage() {
  const router = useRouter();
  // ✅ CHANGED: beaches + beachesLoading now come from context instead of a local getDocs fetch
  const { setArea, setZone, area: savedArea, zone: savedZone, beaches, beachesLoading } = useUser();

  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [expandedArea, setExpandedArea] = useState<string | null>(savedArea || null);
  const [selectedAreaName, setSelectedAreaName] = useState<string | null>(savedArea || null);
  const [selectedZoneNum, setSelectedZoneNum] = useState<number | null>(savedZone || null);
  const [selectedFee, setSelectedFee] = useState<number | null>(null);

  // ✅ CHANGED: group the already-fetched `beaches` array instead of running getDocs here
  useEffect(() => {
    const grouped: Record<string, AreaGroup["beaches"]> = {};
    beaches.forEach((b) => {
      if (!grouped[b.area]) grouped[b.area] = [];
      grouped[b.area].push({ id: b.id, name: b.name, zones: b.zones || [] });
    });
    const groups: AreaGroup[] = Object.entries(grouped).map(([name, list]) => ({ name, beaches: list }));
    setAreaGroups(groups);
  }, [beaches]);

  const handleConfirm = () => {
    if (selectedAreaName && selectedZoneNum) {
      setArea(selectedAreaName);
      setZone(selectedZoneNum);
      router.push("/home");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 pb-40">
        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold mb-2">Select Location</h1>
          <p className="text-muted">Where are you enjoying the beach?</p>
        </div>

        {beachesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
          </div>
        ) : (
          <div className="space-y-4">
            {areaGroups.map((group) => (
              <div
                key={group.name}
                className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                  expandedArea === group.name ? "border-primary bg-card" : "border-border bg-card/50"
                }`}
              >
                <div
                  onClick={() => setExpandedArea(expandedArea === group.name ? null : group.name)}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      expandedArea === group.name ? "bg-primary/20 text-primary" : "bg-muted/20 text-muted"
                    }`}>
                      <MapPin size={20} />
                    </div>
                    <span className="font-semibold text-lg">{group.name}</span>
                  </div>
                  {expandedArea === group.name
                    ? <ChevronUp className="text-muted" />
                    : <ChevronDown className="text-muted" />}
                </div>

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  expandedArea === group.name ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                }`}>
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                    {group.beaches.map((beach) => (
                      <div key={beach.id}>
                        <p className="text-xs text-muted font-medium mb-2 uppercase tracking-wide">
                          📍 {beach.name}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {beach.zones.map((zone, idx) => {
                            const zoneNum = idx + 1;
                            const isSelected = selectedAreaName === group.name && selectedZoneNum === zoneNum;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedAreaName(group.name);
                                  setSelectedZoneNum(zoneNum);
                                  setSelectedFee(zone.fee);
                                }}
                                className={`relative p-3 rounded-xl border text-left transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="font-semibold mb-1 text-sm">{zone.name}</div>
                                <div className="text-xs text-muted">
                                  {zone.minDistance}m – {zone.maxDistance}m
                                </div>
                                <div className="text-xs font-bold text-primary mt-1">
                                  ₹{zone.fee} delivery
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom — always visible */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-3">
        {selectedFee && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5 text-sm text-primary font-medium">
            🚴 Delivery fee for selected zone: <span className="font-bold">₹{selectedFee}</span>
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selectedAreaName || !selectedZoneNum}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}