package com.pulse.backend.domain;

import com.pulse.backend.domain.UndoneAccountabilityEngine.TaskAccountabilityStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Pure, stateless analytical engine that partitions open tasks into 3 swipeable
 * Horizon Window Cards (each sorted in strict descending order of friction/age)
 * alongside summary metrics.
 */
public final class TaskVisualAnalyticsEngine {

    private TaskVisualAnalyticsEngine() {}

    public enum HorizonWindowType {
        HABITUALLY_UNDONE("Habitually Undone", "Habitual", "Sorted descending by deferral count"),
        LONG_STANDING_DRIFT("Long-Standing Drift", "Drifting", "Sorted descending by days untouched or overdue"),
        ACTIVE_FLOW("Committed & Active Flow", "Active", "Today's Top 3 commitments first, then descending by age");

        private final String title;
        private final String shortTabTitle;
        private final String subtitle;

        HorizonWindowType(String title, String shortTabTitle, String subtitle) {
            this.title = title;
            this.shortTabTitle = shortTabTitle;
            this.subtitle = subtitle;
        }

        public String title() {
            return title;
        }

        public String shortTabTitle() {
            return shortTabTitle;
        }

        public String subtitle() {
            return subtitle;
        }
    }

    public record HorizonWindowBarItem(
            String taskId,
            String title,
            String shortLabel,
            String primaryMetricLabel,
            String secondaryMetricLabel,
            float intensityFraction,
            AccountabilityCategory category,
            int deferCount,
            long daysOld,
            long daysUntouched,
            long daysOverdue,
            long sortScore
    ) {}

    public record HorizonWindowCardModel(
            HorizonWindowType windowType,
            String title,
            String shortTabTitle,
            String subtitle,
            String headlineStat,
            String emptyStateTitle,
            String emptyStateBody,
            List<HorizonWindowBarItem> items
    ) {}

    public record TaskHorizonAnalyticsSnapshot(
            List<HorizonWindowCardModel> windows,
            int habitualDeferralCount,
            int longStandingCount,
            int committedTodayCount,
            int healthyBacklogCount,
            double averageStalledDeferrals,
            long oldestOpenDays,
            int clarityRatioPercent
    ) {}

    public static TaskHorizonAnalyticsSnapshot buildHorizonSnapshot(
            List<TaskAccountabilityStatus> statuses
    ) {
        List<TaskAccountabilityStatus> openStatuses = statuses.stream()
                .filter(s -> s.category() != AccountabilityCategory.COMPLETED_OR_PARKED)
                .toList();

        if (openStatuses.isEmpty()) {
            return new TaskHorizonAnalyticsSnapshot(
                    buildWindows(List.of()),
                    0, 0, 0, 0, 0.0, 0L, 100
            );
        }

        int habitual = (int) openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.HABITUALLY_DEFERRED)
                .count();
        int longStanding = (int) openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.LONG_STANDING_GHOSTED)
                .count();
        int committed = (int) openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.ACTIVE_COMMITTED)
                .count();
        int healthy = (int) openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.HEALTHY_BACKLOG)
                .count();

        List<TaskAccountabilityStatus> stalledList = openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.HABITUALLY_DEFERRED
                        || s.category() == AccountabilityCategory.LONG_STANDING_GHOSTED)
                .toList();

        double avgDeferrals = stalledList.isEmpty()
                ? 0.0
                : Math.round(stalledList.stream().mapToInt(s -> s.task().deferCount()).average().orElse(0.0) * 10.0) / 10.0;

        long oldestDays = openStatuses.stream()
                .mapToLong(s -> Math.max(
                        Math.max(s.daysOld(), s.daysUntouched()),
                        Math.max(s.daysOverdue(), s.task().deferCount() * 2L)
                ))
                .max()
                .orElse(0L);

        int clearCount = committed + healthy;
        int clarityPercent = Math.clamp(
                (int) Math.round(((double) clearCount / (double) openStatuses.size()) * 100.0),
                0,
                100
        );

        return new TaskHorizonAnalyticsSnapshot(
                buildWindows(openStatuses),
                habitual,
                longStanding,
                committed,
                healthy,
                avgDeferrals,
                oldestDays,
                clarityPercent
        );
    }

    public static List<HorizonWindowCardModel> buildWindows(
            List<TaskAccountabilityStatus> openStatuses
    ) {
        // Window 1: Habitually Undone (deferCount >= 2), descending by deferCount then age
        List<TaskAccountabilityStatus> habitualStatuses = openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.HABITUALLY_DEFERRED)
                .sorted(Comparator
                        .<TaskAccountabilityStatus>comparingInt(s -> s.task().deferCount()).reversed()
                        .thenComparing(Comparator.<TaskAccountabilityStatus>comparingLong(
                                s -> Math.max(s.daysOverdue(), Math.max(s.daysUntouched(), s.daysOld()))
                        ).reversed())
                        .thenComparing(s -> s.task().title()))
                .toList();

        int maxHabitualDefer = habitualStatuses.stream()
                .mapToInt(s -> s.task().deferCount())
                .max()
                .orElse(4);
        maxHabitualDefer = Math.max(2, maxHabitualDefer);

        List<HorizonWindowBarItem> habitualItems = new ArrayList<>();
        for (TaskAccountabilityStatus status : habitualStatuses) {
            long age = Math.max(status.daysOld(), Math.max(status.daysUntouched(), status.task().deferCount() * 2L));
            float fraction = Math.clamp((float) status.task().deferCount() / (float) maxHabitualDefer, 0.28f, 1.0f);
            habitualItems.add(new HorizonWindowBarItem(
                    status.task().id(),
                    status.task().title(),
                    truncateLabel(status.task().title(), 28),
                    status.task().deferCount() + "× deferred",
                    age + "d span",
                    fraction,
                    status.category(),
                    status.task().deferCount(),
                    status.daysOld(),
                    status.daysUntouched(),
                    status.daysOverdue(),
                    status.task().deferCount() * 1000L + age
            ));
        }

        // Window 2: Long-Standing Drift (5d+ untouched or overdue), descending by drift days
        List<TaskAccountabilityStatus> driftStatuses = openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.LONG_STANDING_GHOSTED)
                .sorted(Comparator
                        .<TaskAccountabilityStatus>comparingLong(
                                s -> Math.max(s.daysOverdue(), Math.max(s.daysUntouched(), s.daysOld()))
                        ).reversed()
                        .thenComparing(Comparator.<TaskAccountabilityStatus>comparingInt(
                                s -> s.task().deferCount()
                        ).reversed())
                        .thenComparing(s -> s.task().title()))
                .toList();

        long maxDriftDays = driftStatuses.stream()
                .mapToLong(s -> Math.max(s.daysOverdue(), Math.max(s.daysUntouched(), s.daysOld())))
                .max()
                .orElse(10L);
        maxDriftDays = Math.max(5L, maxDriftDays);

        List<HorizonWindowBarItem> driftItems = new ArrayList<>();
        for (TaskAccountabilityStatus status : driftStatuses) {
            long driftDays = Math.max(status.daysOverdue(), Math.max(status.daysUntouched(), status.daysOld()));
            float fraction = Math.clamp((float) driftDays / (float) maxDriftDays, 0.28f, 1.0f);
            String primaryLabel = status.daysOverdue() > 0
                    ? status.daysOverdue() + "d overdue"
                    : driftDays + "d idle";
            String secondaryLabel = status.task().deferCount() > 0
                    ? status.task().deferCount() + "× slip"
                    : "Untouched";
            driftItems.add(new HorizonWindowBarItem(
                    status.task().id(),
                    status.task().title(),
                    truncateLabel(status.task().title(), 28),
                    primaryLabel,
                    secondaryLabel,
                    fraction,
                    status.category(),
                    status.task().deferCount(),
                    status.daysOld(),
                    status.daysUntouched(),
                    status.daysOverdue(),
                    driftDays * 1000L + status.task().deferCount()
            ));
        }

        // Window 3: Committed & Active Flow (Top 3 first, then descending by deferCount & age)
        List<TaskAccountabilityStatus> activeStatuses = openStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.ACTIVE_COMMITTED
                        || s.category() == AccountabilityCategory.HEALTHY_BACKLOG)
                .sorted(Comparator
                        .<TaskAccountabilityStatus>comparingInt(
                                s -> s.category() == AccountabilityCategory.ACTIVE_COMMITTED ? 1 : 0
                        ).reversed()
                        .thenComparing(Comparator.<TaskAccountabilityStatus>comparingInt(
                                s -> s.task().deferCount()
                        ).reversed())
                        .thenComparing(Comparator.<TaskAccountabilityStatus>comparingLong(
                                s -> Math.max(s.daysOld(), s.daysUntouched())
                        ).reversed())
                        .thenComparing(s -> s.task().title()))
                .toList();

        List<HorizonWindowBarItem> activeItems = new ArrayList<>();
        for (int idx = 0; idx < activeStatuses.size(); idx++) {
            TaskAccountabilityStatus status = activeStatuses.get(idx);
            boolean isTop3 = status.category() == AccountabilityCategory.ACTIVE_COMMITTED;
            long age = Math.max(status.daysOld(), status.daysUntouched());
            float fraction = isTop3
                    ? Math.clamp(1.0f - (idx * 0.12f), 0.65f, 1.0f)
                    : Math.clamp(0.55f - (idx * 0.06f), 0.25f, 0.55f);
            String secondaryLabel;
            if (status.task().deferCount() > 0) {
                secondaryLabel = "Deferred " + status.task().deferCount() + "×";
            } else if (isTop3) {
                secondaryLabel = "Locked Today";
            } else {
                secondaryLabel = "In Flow";
            }
            activeItems.add(new HorizonWindowBarItem(
                    status.task().id(),
                    status.task().title(),
                    truncateLabel(status.task().title(), 28),
                    isTop3 ? "Top 3" : age + "d old",
                    secondaryLabel,
                    fraction,
                    status.category(),
                    status.task().deferCount(),
                    status.daysOld(),
                    status.daysUntouched(),
                    status.daysOverdue(),
                    (isTop3 ? 10_000L : 0L) + status.task().deferCount() * 100L + age
            ));
        }

        long top3Count = activeStatuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.ACTIVE_COMMITTED)
                .count();

        return List.of(
                new HorizonWindowCardModel(
                        HorizonWindowType.HABITUALLY_UNDONE,
                        HorizonWindowType.HABITUALLY_UNDONE.title(),
                        HorizonWindowType.HABITUALLY_UNDONE.shortTabTitle() + " (" + habitualItems.size() + ")",
                        HorizonWindowType.HABITUALLY_UNDONE.subtitle(),
                        habitualItems.isEmpty() ? "0 tasks" : "Max " + habitualItems.getFirst().deferCount() + "×",
                        "Zero Habitually Deferred Tasks",
                        "No tasks have slipped 2 or more times. Switch windows to inspect Long-Standing Drift or Active Flow.",
                        habitualItems
                ),
                new HorizonWindowCardModel(
                        HorizonWindowType.LONG_STANDING_DRIFT,
                        HorizonWindowType.LONG_STANDING_DRIFT.title(),
                        HorizonWindowType.LONG_STANDING_DRIFT.shortTabTitle() + " (" + driftItems.size() + ")",
                        HorizonWindowType.LONG_STANDING_DRIFT.subtitle(),
                        driftItems.isEmpty() ? "0 tasks" : maxDriftDays + "d oldest",
                        "Zero Long-Standing Drift",
                        "Nothing is sitting untouched for 5+ days without a commitment. Switch windows to view Habitual or Active Flow.",
                        driftItems
                ),
                new HorizonWindowCardModel(
                        HorizonWindowType.ACTIVE_FLOW,
                        HorizonWindowType.ACTIVE_FLOW.title(),
                        HorizonWindowType.ACTIVE_FLOW.shortTabTitle() + " (" + activeItems.size() + ")",
                        HorizonWindowType.ACTIVE_FLOW.subtitle(),
                        top3Count + "/3 Top-3",
                        "No Active Flow Tasks Yet",
                        "Sync with Google Tasks or lock in up to 3 priorities for today.",
                        activeItems
                )
        );
    }

    public static String truncateLabel(String title, int maxChars) {
        String clean = title.trim();
        if (clean.length() <= maxChars) {
            return clean;
        }
        return clean.substring(0, maxChars - 1).stripTrailing() + "…";
    }
}
