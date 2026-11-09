package com.pulse.accountability

import android.app.Application
import com.pulse.accountability.data.local.PulseDatabase
import com.pulse.accountability.data.local.UserPreferencesRepository
import com.pulse.accountability.data.repository.PulseRepository
import com.pulse.accountability.observability.PulseObservability

class PulseApplication : Application() {
    lateinit var database: PulseDatabase
        private set

    lateinit var userPreferencesRepository: UserPreferencesRepository
        private set

    lateinit var repository: PulseRepository
        private set

    override fun onCreate() {
        super.onCreate()
        PulseObservability.init(isDebugBuild = BuildConfig.DEBUG)
        PulseObservability.recordBreadcrumb("app_startup", mapOf("version" to BuildConfig.VERSION_NAME))
        PulseObservability.sendTestSignal()
        database = PulseDatabase.getInstance(this)
        userPreferencesRepository = UserPreferencesRepository(this)
        repository = PulseRepository(
            dao = database.pulseDao(),
            prefs = userPreferencesRepository
        )
    }
}
