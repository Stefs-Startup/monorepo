package com.pulse.accountability.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface PulseDao {
    @Query("SELECT * FROM tasks ORDER BY isCompleted ASC, CASE WHEN dueEpochMillis IS NULL THEN 1 ELSE 0 END, dueEpochMillis ASC, updatedEpochMillis DESC")
    fun observeAllTasks(): Flow<List<TaskItemEntity>>

    @Query("SELECT * FROM tasks")
    suspend fun getAllTasksOnce(): List<TaskItemEntity>

    @Query("SELECT * FROM tasks WHERE id = :id LIMIT 1")
    suspend fun getTaskById(id: String): TaskItemEntity?

    @Query("SELECT * FROM tasks WHERE googleTaskId = :googleId LIMIT 1")
    suspend fun getTaskByGoogleId(googleId: String): TaskItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTask(task: TaskItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTasks(tasks: List<TaskItemEntity>)

    @Update
    suspend fun updateTask(task: TaskItemEntity)

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun deleteTaskById(id: String)

    @Query("DELETE FROM tasks")
    suspend fun clearAllTasks()

    // Weekly Goals
    @Query("SELECT * FROM weekly_goals WHERE isArchived = 0 ORDER BY weekStartIsoDate DESC")
    fun observeActiveGoals(): Flow<List<WeeklyGoalEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertGoal(goal: WeeklyGoalEntity)

    @Query("DELETE FROM weekly_goals WHERE id = :id")
    suspend fun deleteGoal(id: String)

    // Reflections
    @Query("SELECT * FROM reflections ORDER BY createdAtMillis DESC")
    fun observeReflections(): Flow<List<ReflectionEntryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReflection(entry: ReflectionEntryEntity)
}

@Database(
    entities = [
        TaskItemEntity::class,
        WeeklyGoalEntity::class,
        ReflectionEntryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class PulseDatabase : RoomDatabase() {
    abstract fun pulseDao(): PulseDao

    companion object {
        @Volatile
        private var INSTANCE: PulseDatabase? = null

        fun getInstance(context: Context): PulseDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    PulseDatabase::class.java,
                    "pulse_accountability.db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
