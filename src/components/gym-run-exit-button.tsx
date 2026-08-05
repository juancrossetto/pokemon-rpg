"use client";

import { useState, useTransition } from "react";
import { abandonGymRun } from "@/actions/abandon-gym-run";
import { ConfirmModal } from "@/components/confirm-modal";
import { GameCtaButton } from "@/components/game-cta-button";

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
  const [pending, startTransition] = useTransition();

  return (
    <>
      <GameCtaButton
        type="button"
        variant="secondary"
        icon="logout"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="mb-0!"
      >
        {labels.emergencyExit}
      </GameCtaButton>

      <ConfirmModal
        open={open}
        title={labels.warningTitle}
        body={labels.warningBody}
        confirmLabel={labels.confirmExit}
        cancelLabel={labels.returnToChallenge}
        tone="danger"
        pending={pending}
        onCancel={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() => {
          startTransition(async () => {
            await abandonGymRun(gymRunId, locale);
          });
        }}
      />
    </>
  );
}
