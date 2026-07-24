"use client";

import { useState } from "react";
import { Star, Camera, CheckCircle2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, setDoc, collection } from "firebase/firestore";

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

interface ReviewModalProps {
  orderId: string;
  vendorId: string;
  stallName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewModal({
  orderId,
  vendorId,
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

      const reviewRef = doc(collection(db, "reviews"));
      await setDoc(reviewRef, {
        orderId,
        vendorId,
        rating,
        reviewText: reviewText.trim(),
        photoUrl,
        createdAt: new Date(),
      });

      await updateDoc(doc(db, "orders", orderId), {
        reviewed: true,
      });

      // Vendor aggregate rating — avgRating = ratingSum / ratingCount
      await updateDoc(doc(db, "vendors", vendorId), {
        ratingSum: increment(rating),
        ratingCount: increment(1),
      });

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