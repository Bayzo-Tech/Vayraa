"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [area, setArea] = useState<string>("");
  const [zone, setZone] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(20);

  useEffect(() => {
    const savedArea = localStorage.getItem("bayzo_area");
    const savedZone = localStorage.getItem("bayzo_zone");
    const savedFee = localStorage.getItem("bayzo_delivery_fee");
    if (savedArea) setArea(savedArea);
    if (savedZone) setZone(Number(savedZone));
    if (savedFee) setDeliveryFee(Number(savedFee));

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUser(currentUser);
            setRole(userDoc.data().role || "user");
          } else {
            await signOut(auth);
            document.cookie = "bayzo_session=; path=/; max-age=0";
            localStorage.removeItem("bayzo_token");
            localStorage.removeItem("user");
            localStorage.removeItem("bayzo_area");
            localStorage.removeItem("bayzo_zone");
            localStorage.removeItem("bayzo_cart");
            localStorage.removeItem("bayzo_delivery_fee");
            setUser(null);
            setRole(null);
            setArea("");
            setZone(null);
            setDeliveryFee(20);
            window.location.href = "/login";
          }
        } catch (error) {
          console.error("Error fetching user:", error);
          setUser(currentUser);
          setRole("user");
        }
      } else {
        document.cookie = "bayzo_session=; path=/; max-age=0";
        localStorage.removeItem("bayzo_token");
        localStorage.removeItem("user");
        setUser(null);
        setRole(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSetArea = (newArea: string) => {
    setArea(newArea);
    localStorage.setItem("bayzo_area", newArea);
  };

  // ✅ FIX: any[] → ZoneType interface use பண்றோம்
  const handleSetZoneWithFee = async (newZone: number | null, beachArea?: string) => {
    setZone(newZone);
    if (newZone !== null) {
      localStorage.setItem("bayzo_zone", newZone.toString());
    } else {
      localStorage.removeItem("bayzo_zone");
    }

    if (newZone === null) {
      setDeliveryFee(20);
      localStorage.setItem("bayzo_delivery_fee", "20");
      return;
    }

    try {
      const targetArea = beachArea || area;
      const beachSnap = await getDocs(collection(db, "beaches"));
      let foundFee = 20;
      beachSnap.docs.forEach((beachDoc) => {
        const beachData = beachDoc.data();
        if (beachData.area === targetArea || beachData.name === targetArea) {
          const zones: { fee?: number; name?: string }[] = beachData.zones || [];
          const matchedZone = zones[newZone - 1];
          if (matchedZone && matchedZone.fee !== undefined) {
            foundFee = Number(matchedZone.fee);
          }
        }
      });
      setDeliveryFee(foundFee);
      localStorage.setItem("bayzo_delivery_fee", foundFee.toString());
    } catch (e) {
      console.error("Fee fetch error:", e);
      setDeliveryFee(20);
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