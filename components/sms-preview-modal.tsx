"use client";

import React, { useState, useEffect } from "react";
import { CalculatedNode, dispatchUnit } from "@/lib/api";
import { AlertCircle, CheckCircle, Truck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SmsPreviewModalProps {
  node: CalculatedNode;
  onClose: () => void;
  onDispatched?: () => void;
}

export function SmsPreviewModal({
  node,
  onClose,
  onDispatched,
}: SmsPreviewModalProps) {
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSent, setDispatchSent] = useState(false);
  const [cooldownMsg, setCooldownMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const shouldIncludeCoords = node.lat && node.lng;
  const mapLink = shouldIncludeCoords
    ? `\nMap: https://www.openstreetmap.org/?mlat=${node.lat}&mlon=${node.lng}`
    : "";

  const smsText = `[CRITICAL ALERT - FLOODGUARD AI]\nNode: #${node.id} (${node.name})\nRisk Score: ${node.fri.toFixed(
    2
  )} | Drain Status: App Dispatch\nRec. Action: Dispatch Hydro-Jet Truck to Clear Ingress Grate.${mapLink}`;

  const handleDispatch = async () => {
    setDispatching(true);
    setCooldownMsg(null);
    try {
      const res = (await dispatchUnit(
        node.id,
        node.name,
        node.fri,
        "Dispatch Hydro-Jet Truck to Clear Ingress Grate",
        { roadVerified: true, screenDetected: false }
      )) as { message?: string; messageId?: string };

      setDispatchSent(true);
      toast.success(res.message || "Priority SMS alert dispatched to municipal trucks");
      onDispatched?.();
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 429) {
        setCooldownMsg("15-minute dispatch cooldown active for this node.");
        toast.warning("15-minute dispatch cooldown active");
      } else {
        toast.error(apiErr.message || "Failed to dispatch alert");
      }
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sms-modal-title"
        className="w-full sm:max-w-[440px] max-h-[90dvh] overflow-y-auto custom-scrollbar bg-[#141414] border border-[#262626] rounded-t-[24px] sm:rounded-[24px] p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
          <div className="flex items-center gap-2 text-[#ef4444] min-w-0 pr-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <h3 id="sms-modal-title" className="font-bold text-[16px] text-white truncate">
              Emergency Dispatch Alert
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#999999] hover:text-white bg-[#1c1c1c] min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Close alert preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SMS Preview Card */}
        <div>
          <span className="text-[11px] font-semibold text-[#999999] uppercase tracking-wider block mb-1.5">
            Automated SMS Payload Preview
          </span>
          <div className="bg-[#090909] border border-[#262626] rounded-[16px] p-3.5 font-mono text-[12px] text-white whitespace-pre-wrap leading-relaxed">
            {smsText}
          </div>
        </div>

        {/* Cooldown Warning if active */}
        {cooldownMsg && (
          <div className="p-3 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-[12px] text-[12px] text-[#fbbf24]">
            {cooldownMsg}
          </div>
        )}

        {/* Optimistic Dispatch Sent Status */}
        {dispatchSent ? (
          <div className="p-3 bg-[#22c55e]/15 border border-[#22c55e]/30 rounded-[14px] flex items-center gap-2 text-[#4ade80] text-[13px] font-bold">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>Dispatch Sent Successfully via Amazon SNS</span>
          </div>
        ) : null}

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full bg-[#1c1c1c] text-white text-xs font-semibold border border-[#262626] hover:bg-[#262626] transition min-h-[44px]"
          >
            Close
          </button>
          {!dispatchSent && (
            <button
              onClick={handleDispatch}
              disabled={dispatching}
              className="flex-1 py-3 rounded-full bg-[#7f1d1d] text-[#fca5a5] border border-[#ef4444] text-xs font-bold hover:bg-[#991b1b] transition active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2"
            >
              {dispatching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Dispatch via SNS</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
