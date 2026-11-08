package com.pulse.backend.domain;

import com.pulse.backend.domain.TaskItem.TaskCommitmentState;

import java.util.ArrayList;
import java.util.List;

public final class ScarcityEngine {
    public static final int MAX_TOP_3_LIMIT = 3;

    private ScarcityEngine() {}

    public sealed interface PinDecision {
        record AllowPin() implements PinDecision {}
        record Unpin() implements PinDecision {}
        record SwapRequired(List<TaskItem> currentCommitments) implements PinDecision {}
    }

    public record SwapResult(
            TaskItem unpinnedTask,
            TaskItem pinnedTask,
            List<TaskItem> newTop3
    ) {}

    public static PinDecision evaluatePinAction(
            List<TaskItem> currentTop3,
            TaskItem candidate
    ) {
        boolean isAlreadyPinned = candidate.commitment() == TaskCommitmentState.TODAY_TOP_3
                || currentTop3.stream().anyMatch(t -> t.id().equals(candidate.id()));

        if (isAlreadyPinned) {
            return new PinDecision.Unpin();
        }

        if (currentTop3.size() < MAX_TOP_3_LIMIT) {
            return new PinDecision.AllowPin();
        }

        return new PinDecision.SwapRequired(currentTop3.stream().limit(MAX_TOP_3_LIMIT).toList());
    }

    public static SwapResult executeSwap(
            List<TaskItem> currentTop3,
            TaskItem toRemove,
            TaskItem toAdd,
            long nowMillis
    ) {
        TaskItem unpinned = toRemove.withCommitment(TaskCommitmentState.NORMAL, nowMillis);
        TaskItem pinned = toAdd.withCommitment(TaskCommitmentState.TODAY_TOP_3, nowMillis);

        List<TaskItem> updatedTop3 = new ArrayList<>();
        for (TaskItem item : currentTop3) {
            if (!item.id().equals(toRemove.id())) {
                updatedTop3.add(item);
            }
        }
        updatedTop3.add(pinned);

        return new SwapResult(
                unpinned,
                pinned,
                updatedTop3.stream().limit(MAX_TOP_3_LIMIT).toList()
        );
    }
}
