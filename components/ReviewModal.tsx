"use client";

import { useState } from "react";
import { Star, Camera, CheckCircle2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  increment,
  setDoc,
  collection,
  getDoc,
  runTransaction,
} from "firebase/firestore";

const CLOUD_NAME = "dvkjhuzdr";
const UPLOAD_PRESET = "bayzo_upload";

const uploadToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("cloud_name", CLOUD_NAME);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
};

// ✅ NEW: transaction based average rating updater — accurate ah sum/count/avg calculate pannum
// (increment() mattum use pannina, avg calculate panna vera read venum, so transaction use pannirukken)
const updateAverageRating = async (
  collectionName: string,
  docId: string,
  newRating: number
) => {
  const ref = doc(db, collectionName, docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const currentSum = (data.ratingSum as number) || 0;
    const currentCount = (data.ratingCount as number) || 0;
    const newSum = currentSum + newRating;
    const newCount = currentCount + 1;
    const newAvg = Math.round((newSum / newCount) * 10) / 10; // 1 decimal
    transaction.set(
      ref,
      { ratingSum: newSum, ratingCount: newCount, rating: newAvg },
      { merge: true }
    );
  });
};

interface ReviewModalProps {
  orderId: string;
  vendorId: string;
  foodIds: string[]; // ✅ NEW: order la irukra unique food IDs
  stallName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewModal({
  orderId,
  vendorId,
  foodIds,
  stallName,
  onClose,
  onSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a star rating");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let photoUrl = "";
      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile);
      }

      // 1. Save the review document
      const reviewRef = doc(collection(db, "reviews"));
      await setDoc(reviewRef, {
        orderId,
        vendorId,
        foodIds,
        rating,
        reviewText: reviewText.trim(),
        photoUrl,
        createdAt: new Date(),
      });

      // 2. Mark order as reviewed (so button doesn't show again)
      await updateDoc(doc(db, "orders", orderId), {
        reviewed: true,
      });

      // 3. Update vendor's aggregate rating (existing logic — kept as is)
      await updateAverageRating("vendors", vendorId, rating);

      // 4. ✅ NEW: Update each food's aggregate rating + its category's aggregate rating
      for (const foodId of foodIds) {
        if (!foodId) continue;
        try {
          await updateAverageRating("foods", foodId, rating);

          // Fetch food's categoryId to also update category-level rating
          const foodSnap = await getDoc(doc(db, "foods", foodId));
          const categoryId = foodSnap.exists() ? (foodSnap.data().categoryId as string) : null;
          if (categoryId) {
            await updateAverageRating("categories", categoryId, rating);
          }
        } catch (e) {
          console.error(`Failed to update rating for food ${foodId}:`, e);
          // continue to next food — one failure shouldn't block others
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
      }, 1500);
    } catch (e) {
      console.error("Review submit error:", e);
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-3xl p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={40} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Review Submitted!</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-foreground">Write Review</h2>
          <button onClick={onClose} className="p-1 text-muted">
            <X size={22} />
          </button>
        </div>

        <p className="text-sm font-semibold text-foreground mb-3">{stallName}</p>

        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
            >
              <Star
                size={36}
                className={
                  star <= (hoverRating || rating)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-border"
                }
              />
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium text-foreground mb-2">Add Photo</label>
        <label className="flex justify-center px-4 py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-card mb-4">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="h-24 object-contain rounded-lg" />
          ) : (
            <div className="text-center">
              <Camera className="mx-auto h-8 w-8 text-muted mb-1" />
              <p className="text-xs text-muted">Click to upload</p>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>

        <label className="block text-sm font-medium text-foreground mb-2">Write your Review</label>
        <textarea
          rows={3}
          maxLength={400}
          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none mb-1"
          placeholder="Would you like to write anything about us?"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
        />
        <p className="text-xs text-muted text-right mb-4">
          {400 - reviewText.length} characters remaining
        </p>

        {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-transform disabled:opacity-60"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
}