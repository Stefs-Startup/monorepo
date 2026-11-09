package com.pulse.accountability.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "pulse_settings")

data class UserSettings(
    val hasCompletedOnboarding: Boolean = false,
    val googleAccountEmail: String = "",
    val googleAccessToken: String = "",
    val isDemoMode: Boolean = true,
    val geminiApiKey: String = "",
    val partnerTone: PartnerTone = PartnerTone.GENTLE_COACH,
    val lastSyncedMillis: Long = 0L,
    val dailyTopLimit: Int = 3,
    val dynamicColorsEnabled: Boolean = true
)

enum class PartnerTone(val title: String, val subtitle: String) {
    GENTLE_COACH("Warm & Grounded", "Empathetic encouragement, zero guilt on overdue tasks"),
    DIRECT_PARTNER("Candid & Focused", "Clear reality checks when tasks get deferred 3+ times"),
    SOCRATIC_GUIDE("Reflective & Curious", "Asks why something is stalling before helping you break it down")
}

class UserPreferencesRepository(private val context: Context) {

    private object Keys {
        val HAS_COMPLETED_ONBOARDING = booleanPreferencesKey("has_completed_onboarding")
        val GOOGLE_EMAIL = stringPreferencesKey("google_email")
        val GOOGLE_ACCESS_TOKEN = stringPreferencesKey("google_access_token")
        val IS_DEMO_MODE = booleanPreferencesKey("is_demo_mode")
        val GEMINI_API_KEY = stringPreferencesKey("gemini_api_key")
        val PARTNER_TONE = stringPreferencesKey("partner_tone")
        val LAST_SYNCED = longPreferencesKey("last_synced_millis")
        val DAILY_TOP_LIMIT = intPreferencesKey("daily_top_limit")
        val DYNAMIC_COLORS = booleanPreferencesKey("dynamic_colors")
        val SEEDED_DEMO = booleanPreferencesKey("seeded_initial_demo")
    }

    val settingsFlow: Flow<UserSettings> = context.dataStore.data.map { prefs ->
        val toneName = prefs[Keys.PARTNER_TONE] ?: PartnerTone.GENTLE_COACH.name
        val tone = runCatching { PartnerTone.valueOf(toneName) }.getOrDefault(PartnerTone.GENTLE_COACH)
        UserSettings(
            hasCompletedOnboarding = prefs[Keys.HAS_COMPLETED_ONBOARDING] ?: false,
            googleAccountEmail = prefs[Keys.GOOGLE_EMAIL] ?: "",
            googleAccessToken = prefs[Keys.GOOGLE_ACCESS_TOKEN] ?: "",
            isDemoMode = prefs[Keys.IS_DEMO_MODE] ?: true,
            geminiApiKey = prefs[Keys.GEMINI_API_KEY] ?: "",
            partnerTone = tone,
            lastSyncedMillis = prefs[Keys.LAST_SYNCED] ?: 0L,
            dailyTopLimit = prefs[Keys.DAILY_TOP_LIMIT] ?: 3,
            dynamicColorsEnabled = prefs[Keys.DYNAMIC_COLORS] ?: true
        )
    }

    val hasSeededDemoFlow: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[Keys.SEEDED_DEMO] ?: false
    }

    suspend fun markDemoSeeded() {
        context.dataStore.edit { it[Keys.SEEDED_DEMO] = true }
    }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[Keys.HAS_COMPLETED_ONBOARDING] = completed
        }
    }

    suspend fun setGoogleSession(email: String, accessToken: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.GOOGLE_EMAIL] = email
            prefs[Keys.GOOGLE_ACCESS_TOKEN] = accessToken
            prefs[Keys.IS_DEMO_MODE] = email.isBlank()
        }
    }

    suspend fun setDemoMode(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[Keys.IS_DEMO_MODE] = enabled
        }
    }

    suspend fun setGeminiApiKey(apiKey: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.GEMINI_API_KEY] = apiKey.trim()
        }
    }

    suspend fun setPartnerTone(tone: PartnerTone) {
        context.dataStore.edit { prefs ->
            prefs[Keys.PARTNER_TONE] = tone.name
        }
    }

    suspend fun setDynamicColors(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[Keys.DYNAMIC_COLORS] = enabled
        }
    }

    suspend fun updateLastSynced(timestampMillis: Long = System.currentTimeMillis()) {
        context.dataStore.edit { prefs ->
            prefs[Keys.LAST_SYNCED] = timestampMillis
        }
    }
}
