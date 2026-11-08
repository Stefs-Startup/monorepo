package com.pulse.backend.domain;

import com.pulse.backend.domain.ScarcityEngine.PinDecision;
import com.pulse.backend.domain.ScarcityEngine.SwapResult;
import com.pulse.backend.domain.TaskItem.TaskCommitmentState;
import com.pulse.backend.domain.TaskItem.TaskEnergyLevel;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class ScarcityEngineTest {

    private TaskItem sampleTask(String id, TaskCommitmentState state) {
        return new TaskItem(
                id, id, "@default", "My Tasks", "Task " + id, "", false,
                null, null, 1000L, 1000L, 0, state, TaskEnergyLevel.FOCUSED, "", false
        );
    }

    @Test
    void enforcesMaxTop3LimitAndRequiresSwapForFourthTask() {
        List<TaskItem> top3 = List.of(
                sampleTask("t1", TaskCommitmentState.TODAY_TOP_3),
                sampleTask("t2", TaskCommitmentState.TODAY_TOP_3),
                sampleTask("t3", TaskCommitmentState.TODAY_TOP_3)
        );
        TaskItem fourth = sampleTask("t4", TaskCommitmentState.NORMAL);

        PinDecision decision = ScarcityEngine.evaluatePinAction(top3, fourth);
        assertInstanceOf(PinDecision.SwapRequired.class, decision);

        SwapResult swap = ScarcityEngine.executeSwap(top3, top3.get(0), fourth, 2000L);
        assertEquals(TaskCommitmentState.NORMAL, swap.unpinnedTask().commitment());
        assertEquals(TaskCommitmentState.TODAY_TOP_3, swap.pinnedTask().commitment());
        assertEquals(3, swap.newTop3().size());
    }
}
