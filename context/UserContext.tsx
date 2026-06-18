"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { User } from "firebase/auth";

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  area: string;
  setArea: (area: string) => void;
  zone: number | null;
  setZone: (zone: number | null, beachArea?: string) => void;
  role: string | null;
  deliveryFee: number;
  setDeliveryFee: (fee: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs, onSnapshot, query } from "firebase/firestore";

// ✅ FIX: SSR-safe localStorage - OnePlus/Samsung crash fix
const safeLocalStorage = {
  get: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(key, value); } catch {}
  },
  remove: (key: string): void => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(key); } catch {}
  },
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const isFirstAuthCheck = useRef(true);
  const [area, setArea] = useState<string>("");
  const [zone, setZone] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(10);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const savedArea = safeLocalStorage.get("bayzo_area");
    const savedZone = safeLocalStorage.get("bayzo_zone");
    const savedFee = safeLocalStorage.get("bayzo_delivery_fee");
    if (savedArea) setArea(savedArea);
    if (savedZone) setZone(Number(savedZone));
    if (savedFee) setDeliveryFee(Number(savedFee));

    let logoutTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (logoutTimer) { clearTimeout(logoutTimer); logoutTimer = null; }
        isFirstAuthCheck.current = false;
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUser(currentUser);
            setRole(userDoc.data().role || "user");
          } else {
            await signOut(auth);
            document.cookie = "bayzo_session=; path=/; max-age=0";
            safeLocalStorage.remove("bayzo_token");
            safeLocalStorage.remove("user");
            safeLocalStorage.remove("bayzo_area");
            safeLocalStorage.remove("bayzo_zone");
            safeLocalStorage.remove("bayzo_cart");
            safeLocalStorage.remove("bayzo_delivery_fee");
            setUser(null);
            setRole(null);
            setArea("");
            setZone(null);
            setDeliveryFee(10);
            window.location.href = "/login";
          }
        } catch (error) {
          console.error("Error fetching user:", error);
          setUser(currentUser);
          setRole("user");
        }
      } else {
        logoutTimer = setTimeout(() => {
          if (isFirstAuthCheck.current) {
            isFirstAuthCheck.current = false;
            setUser(null);
            setRole(null);
          } else {
            document.cookie = "bayzo_session=; path=/; max-age=0";
            safeLocalStorage.remove("bayzo_token");
            safeLocalStorage.remove("user");
            setUser(null);
            setRole(null);
          }
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
      if (logoutTimer) clearTimeout(logoutTimer);
    };
  }, [mounted]);

  // Real-time listener for the delivery fee based on area and zone
  useEffect(() => {
    if (!mounted) return;
    if (!area || zone === null) {
      setDeliveryFee(10);
      safeLocalStorage.set("bayzo_delivery_fee", "10");
      return;
    }

    const q = query(collection(db, "beaches"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let foundFee = 10;
      const matchedBeach = snapshot.docs.find((beachDoc) => {
        const beachData = beachDoc.data();
        return beachData.name === area || beachData.area === area;
      });
      if (matchedBeach) {
        const zones: { fee?: number; name?: string }[] = matchedBeach.data().zones || [];
        const matchedZone = zones[zone - 1];
        if (matchedZone && matchedZone.fee !== undefined) {
          foundFee = Number(matchedZone.fee);
        }
      }
      setDeliveryFee(foundFee);
      safeLocalStorage.set("bayzo_delivery_fee", foundFee.toString());
    }, (error) => {
      console.error("Real-time fee fetch error:", error);
    });

    return () => unsubscribe();
  }, [area, zone, mounted]);

  const handleSetArea = (newArea: string) => {
    setArea(newArea);
    if (mounted) {
      safeLocalStorage.set("bayzo_area", newArea);
    }
  };

  // ✅ FIX: any[] → ZoneType interface use பண்றோம்
  const handleSetZoneWithFee = async (newZone: number | null, beachArea?: string) => {
    setZone(newZone);
    if (mounted) {
      if (newZone !== null) {
        safeLocalStorage.set("bayzo_zone", newZone.toString());
      } else {
        safeLocalStorage.remove("bayzo_zone");
      }
    }

    if (newZone === null) {
      setDeliveryFee(10);
      if (mounted) {
        safeLocalStorage.set("bayzo_delivery_fee", "10");
      }
      return;
    }

    try {
      const targetArea = beachArea || area;
      const beachSnap = await getDocs(collection(db, "beaches"));
      let foundFee = 10;
      const matchedBeach = beachSnap.docs.find((beachDoc) => {
        const beachData = beachDoc.data();
        return beachData.name === targetArea || beachData.area === targetArea;
      });
      if (matchedBeach) {
        const zones: { fee?: number; name?: string }[] = matchedBeach.data().zones || [];
        const matchedZone = zones[newZone - 1];
        if (matchedZone && matchedZone.fee !== undefined) {
          foundFee = Number(matchedZone.fee);
        }
      }
      setDeliveryFee(foundFee);
      if (mounted) {
        safeLocalStorage.set("bayzo_delivery_fee", foundFee.toString());
      }
    } catch (e) {
      console.error("Fee fetch error:", e);
      setDeliveryFee(10);
    }
  };

  return (
    <UserContext.Provider value={{
      user, setUser,
      area, setArea: handleSetArea,
      zone, setZone: handleSetZoneWithFee,
      role,
      deliveryFee, setDeliveryFee,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}