package app.cor3.helper

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.WebExtension
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Two GeckoViews stacked in one window:
 *   - gameView:   the real cor3.gg page (desktop mode), where the extension's content scripts run
 *   - helperView: the extension's own popup.html shown full screen
 * Both sessions stay active so the game page is not paused while you look at the helper.
 * The bar at the bottom just brings one of them to the front.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "Cor3App"
        private const val EXT_ID = "cor3-helper-android@local"          // must match tools/patch_extension.py
        private const val EXT_URI = "resource://android/assets/ext/"
        private const val GAME_URL = "https://cor3.gg/"
        private var runtime: GeckoRuntime? = null
    }

    private lateinit var gameView: GeckoView
    private lateinit var helperView: GeckoView
    private lateinit var gameSession: GeckoSession
    private lateinit var helperSession: GeckoSession
    private var helperUrl: String? = null
    private var extension: WebExtension? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val rt = runtime ?: GeckoRuntime.create(
            this,
            GeckoRuntimeSettings.Builder()
                .remoteDebuggingEnabled(true)   // lets you inspect via about:debugging on a PC if needed
                .consoleOutput(true)
                .build()
        ).also { runtime = it }

        gameSession = GeckoSession(
            GeckoSessionSettings.Builder()
                .usePrivateMode(false)
                .userAgentMode(GeckoSessionSettings.USER_AGENT_MODE_DESKTOP)
                .viewportMode(GeckoSessionSettings.VIEWPORT_MODE_DESKTOP)
                .build()
        )
        helperSession = GeckoSession(
            GeckoSessionSettings.Builder().usePrivateMode(false).build()
        )

        gameView = GeckoView(this)
        helperView = GeckoView(this)
        gameSession.open(rt)
        helperSession.open(rt)
        gameView.setSession(gameSession)
        helperView.setSession(helperSession)
        gameSession.setActive(true)
        helperSession.setActive(true)

        buildLayout()
        installExtensionThenLoad(rt)
        requestBatteryExemptionOnce()
    }

    private fun buildLayout() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
        }
        // Keep everything clear of the status bar, navigation bar, cutout and keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#151c22"))
        }
        fun btn(label: String, onClick: () -> Unit) = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { onClick() }
        }.also { bar.addView(it, LinearLayout.LayoutParams(0, -2, 1f)) }

        btn("Helper") { showHelper() }
        btn("Game / login") { showGame() }
        btn("Reload") { reloadAll() }
        root.addView(bar, LinearLayout.LayoutParams(-1, -2))   // bar now on top

        val stack = FrameLayout(this)
        stack.addView(gameView, FrameLayout.LayoutParams(-1, -1))
        stack.addView(helperView, FrameLayout.LayoutParams(-1, -1))
        root.addView(stack, LinearLayout.LayoutParams(-1, 0, 1f))

        setContentView(root)
        showHelper()
    }

    // GeckoView renders into a SurfaceView, which ignores sibling z-order changes from bringToFront().
    // Toggle visibility instead; both sessions stay active so the game page keeps running.
    private fun showHelper() {
        gameView.visibility = View.INVISIBLE
        helperView.visibility = View.VISIBLE
        helperView.bringToFront()
    }

    private fun showGame() {
        helperView.visibility = View.INVISIBLE
        gameView.visibility = View.VISIBLE
        gameView.bringToFront()
    }

    private fun installExtensionThenLoad(rt: GeckoRuntime) {
        // ensureBuiltIn installs the bundled extension, and upgrades it when the bundled version changes.
        rt.webExtensionController.ensureBuiltIn(EXT_URI, EXT_ID).accept({ ext ->
            extension = ext
            if (ext == null) {
                Log.e(TAG, "ensureBuiltIn returned null")
                return@accept
            }
            Log.i(TAG, "Extension ready: ${ext.metaData.name} ${ext.metaData.version}")
            // Make the game session the extension's "active tab" so tabs.query/sendMessage from the
            // helper popup reach the page where the content scripts run.
            rt.webExtensionController.setTabActive(helperSession, false)
            rt.webExtensionController.setTabActive(gameSession, true)
            helperUrl = ext.metaData.baseUrl + "popup.html?mode=sidepanel"
            // The game page must load AFTER the extension is installed so content scripts attach.
            gameSession.loadUri(GAME_URL)
            helperSession.loadUri(helperUrl!!)
        }, { err ->
            Log.e(TAG, "Extension install failed", err)
            gameSession.loadUri(GAME_URL)
        })
    }

    private fun reloadAll() {
        gameSession.reload()
        helperUrl?.let { helperSession.loadUri(it) }
    }

    private fun requestBatteryExemptionOnce() {
        val prefs = getSharedPreferences("app", MODE_PRIVATE)
        if (prefs.getBoolean("asked_battery", false)) return
        prefs.edit().putBoolean("asked_battery", true).apply()
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            try {
                startActivity(
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        .setData(Uri.parse("package:$packageName"))
                )
            } catch (e: Exception) {
                Log.w(TAG, "battery exemption prompt failed", e)
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (gameView.visibility == View.VISIBLE) {
            // game view on top: just go back to helper instead of leaving the app
            showHelper()
        } else {
            moveTaskToBack(true)
        }
    }
}
