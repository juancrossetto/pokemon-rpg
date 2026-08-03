"use client";

import { useState } from "react";
import { abandonGymRun } from "@/actions/abandon-gym-run";

export function GymRunExitButton({
  gymRunId,
  locale,
  labels,
}: {
  gymRunId: string;
  locale: string;
  labels: {
    emergencyExit: string;
    warningTitle: string;
    warningBody: string;
    confirmExit: string;
    returnToChallenge: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-error/15 border border-error/35 px-4 py-3 text-label-md text-error/90 hover:bg-error/25 hover:border-error/50 hover:text-error transition-all"
      >
        <span className="material-symbols-outlined text-[18px]!">warning</span>
        {labels.emergencyExit}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-margin-mobile">
          <div className="glass-panel border-error/50 p-6 max-w-sm w-full text-center">
            <span className="material-symbols-outlined text-[40px]! text-error">warning</span>
            <h3 className="text-headline-md text-error mt-2">{labels.warningTitle}</h3>
            <p className="text-label-md text-on-surface-variant mt-2">{labels.warningBody}</p>
            <div className="flex flex-col gap-2 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full ui-btn-primary px-4 py-2 text-label-md"
              >
                {labels.returnToChallenge}
              </button>
              <form action={abandonGymRun.bind(null, gymRunId, locale)}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-white/20 px-4 py-2 text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {labels.confirmExit}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
