"use client";

import { useCart } from "@/context/CartContext";
import { Star, Plus, Minus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  image: string;
  area: string;
  offer?: string;
  description?: string;
  [key: string]: unknown;
}

interface FoodCardProps {
  food: FoodItem;
}

export function FoodCard({ food }: FoodCardProps) {
  const { items, addToCart, updateQuantity } = useCart();

  const cartItem = items.find((item) => item.id === food.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: food.id,
      name: food.name,
      price: food.price,
      image: food.image,
    });
  };

  const handleUpdate = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(food.id, delta);
  };

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm flex flex-col">
      <Link href={`/food/${food.id}`} className="relative h-36 w-full block">
        {food.image ? (
          <Image
            src={food.image}
            alt={food.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-gray-500 text-xs">No Image</span>
          </div>
        )}
        {food.offer && (
          <div className="absolute top-2 left-2 bg-secondary text-background text-xs font-bold px-2 py-1 rounded-md shadow-md">
            {food.offer}
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1">
          <Link href={`/food/${food.id}`} className="font-semibold text-foreground text-sm flex-grow line-clamp-1">
            {food.name}
          </Link>
        </div>

        <div className="flex items-center gap-1 mb-2">
          <Star size={14} className="text-secondary fill-secondary" />
          <span className="text-xs text-muted font-medium">{food.rating ?? "4.0"}</span>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="font-bold text-base text-foreground">₹{food.price}</span>

          {quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="bg-primary/10 text-primary border border-primary/20 p-2 rounded-xl flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              <Plus size={18} />
            </button>
          ) : (
            <div className="flex items-center bg-primary rounded-xl overflow-hidden text-white shadow-sm border border-primary h-9">
              <button
                onClick={(e) => handleUpdate(e, -1)}
                className="w-8 h-full flex items-center justify-center active:bg-black/20"
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center text-sm font-bold">
                {quantity}
              </span>
              <button
                onClick={(e) => handleUpdate(e, 1)}
                className="w-8 h-full flex items-center justify-center active:bg-black/20"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}