package app.cor3.helper

import android.content.pm.ApplicationInfo
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.WebExtension
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * One GeckoView that shows one of two sessions at a time:
 *   - gameSession:   the real cor3.gg page (desktop mode), where the extension's content scripts run
 *   - helperSession: the extension's own popup.html shown full screen
 * Both sessions stay open and active so the game page keeps running while you look at the helper.
 * The bar on top swaps which session the view displays. It stays hidden until the game page has
 * loaded, so the app starts on the game's own loading screen.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "Cor3App"
        private const val EXT_ID = "cor3-helper-android@local"          // must match tools/patch_extension.py
        private const val EXT_URI = "resource://android/assets/ext/"
        private const val GAME_URL = "https://cor3.gg/"
        private const val BAR_FALLBACK_MS = 25_000L   // show the bar even if the extension never reports "ready"
        private val TEAL = Color.parseColor("#76C1D1")   // the game's accent colour
        private val DIM = Color.parseColor("#6B7888")    // the game's secondary text colour
        private var runtime: GeckoRuntime? = null
    }

    private lateinit var geckoView: GeckoView
    private lateinit var bar: LinearLayout
    private lateinit var helperBtn: Button
    private lateinit var gameBtn: Button
    private var showingGame = true
    private val uiHandler = Handler(Looper.getMainLooper())
    private lateinit var gameSession: GeckoSession
    private lateinit var helperSession: GeckoSession
    private var helperUrl: String? = null
    private var extension: WebExtension? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Remote debugging exposes the page (including the login token) to anyone with adb access,
        // so it is only on for debuggable builds (Android Studio "Run"), never in release APKs.
        val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        val rt = runtime ?: GeckoRuntime.create(
            this,
            GeckoRuntimeSettings.Builder()
                .remoteDebuggingEnabled(isDebuggable)   // lets you inspect via about:debugging on a PC in debug builds
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

        geckoView = GeckoView(this)
        gameSession.open(rt)
        helperSession.open(rt)
        gameSession.setActive(true)
        helperSession.setActive(true)

        // Reveal the top bar once the game page has finished loading (or after a fallback delay).
        gameSession.progressDelegate = object : GeckoSession.ProgressDelegate {
            // The bar comes back when the extension reports that the game's own loader ("Preparing your
            // workspace") is gone, see app-bridge.js. BAR_FALLBACK_MS covers the case where that never arrives.
            override fun onPageStart(session: GeckoSession, url: String) {
                runOnUiThread { hideBarUntilLoaded() }
            }
        }
        uiHandler.postDelayed(revealBarRunnable, BAR_FALLBACK_MS)

        buildLayout()
        installExtensionThenLoad(rt)
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

        // Top bar in the game's look: black, monospace, teal [bracketed] labels. Hidden until the game loads.
        bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
            setPadding(dp(6), dp(6), dp(6), dp(6))
            visibility = View.GONE
        }
        fun btn(label: String, onClick: () -> Unit) = Button(this).apply {
            text = label
            isAllCaps = false
            typeface = Typeface.MONOSPACE
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            letterSpacing = 0.05f
            minHeight = 0
            minimumHeight = 0
            minWidth = 0
            minimumWidth = 0
            stateListAnimator = null
            elevation = 0f
            setPadding(dp(4), dp(8), dp(4), dp(8))
            setOnClickListener { onClick() }
        }.also {
            bar.addView(it, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(dp(3), 0, dp(3), 0) })
        }

        helperBtn = btn("[ HELPER ]") { showHelper() }
        gameBtn = btn("[ GAME / LOGIN ]") { showGame() }
        val reloadBtn = btn("[ RELOAD ]") { reloadAll() }
        styleBarButton(reloadBtn, active = false)
        root.addView(bar, LinearLayout.LayoutParams(-1, -2))

        root.addView(geckoView, LinearLayout.LayoutParams(-1, 0, 1f))

        setContentView(root)
        showGame()   // start on the game so its own loading screen is the first thing you see
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density + 0.5f).toInt()

    /** Flat, square button with a thin teal outline; the selected tab gets a teal tint. */
    private fun styleBarButton(b: Button, active: Boolean) {
        val shape = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 0f
            setStroke(dp(1), if (active) TEAL else Color.parseColor("#2A3640"))
            setColor(if (active) Color.parseColor("#1F76C1D1") else Color.BLACK)
        }
        b.background = RippleDrawable(ColorStateList.valueOf(Color.parseColor("#3376C1D1")), shape, null)
        b.setTextColor(if (active) TEAL else DIM)
    }

    private val revealBarRunnable = Runnable { revealBar() }

    private fun revealBar() {
        uiHandler.removeCallbacks(revealBarRunnable)
        if (bar.visibility != View.VISIBLE) bar.visibility = View.VISIBLE
    }

    /** Hide the bar while the game page (re)loads; it comes back on page load, or after a fallback delay. */
    private fun hideBarUntilLoaded() {
        if (!::bar.isInitialized) return
        bar.visibility = View.GONE
        uiHandler.removeCallbacks(revealBarRunnable)
        uiHandler.postDelayed(revealBarRunnable, BAR_FALLBACK_MS)
    }

    // One GeckoView, two sessions: swapping the session (instead of stacking two GeckoViews) avoids
    // SurfaceView z-order/visibility glitches such as a black screen on some devices. Both sessions
    // stay active, so the game page keeps running while the helper is shown.
    private fun showSession(game: Boolean) {
        val target = if (game) gameSession else helperSession
        if (geckoView.session !== target) {
            geckoView.releaseSession()
            geckoView.setSession(target)
        }
        gameSession.setActive(true)
        helperSession.setActive(true)
        showingGame = game
        styleBarButton(gameBtn, active = game)
        styleBarButton(helperBtn, active = !game)
    }

    private fun showHelper() = showSession(false)

    private fun showGame() = showSession(true)

    private fun installExtensionThenLoad(rt: GeckoRuntime) {
        // ensureBuiltIn installs the bundled extension, and upgrades it when the bundled version changes.
        rt.webExtensionController.ensureBuiltIn(EXT_URI, EXT_ID).accept({ ext ->
            extension = ext
            if (ext == null) {
                Log.e(TAG, "ensureBuiltIn returned null")
                return@accept
            }
            Log.i(TAG, "Extension ready: ${ext.metaData.name} ${ext.metaData.version}")
            // The extension tells us when the game's loader is on screen / gone (native messaging "cor3app").
            ext.setMessageDelegate(object : WebExtension.MessageDelegate {
                override fun onMessage(
                    nativeApp: String,
                    message: Any,
                    sender: WebExtension.MessageSender
                ): GeckoResult<Any>? {
                    // GeckoView may hand the message over as a JSONObject, a String or another type,
                    // so don't rely on one class: look at its text form.
                    val text = (message as? JSONObject)?.toString() ?: message.toString()
                    Log.i(TAG, "bridge message (${message.javaClass.simpleName}): $text")
                    runOnUiThread {
                        when {
                            text.contains("ready") -> revealBar()
                            text.contains("loading") -> hideBarUntilLoaded()
                        }
                    }
                    return GeckoResult.fromValue(null)
                }
            }, "cor3app")
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
        // Show the game and hide the bar so you can't open the helper until the game has loaded again.
        showGame()
        hideBarUntilLoaded()
        gameSession.reload()
        helperUrl?.let { helperSession.loadUri(it) }
    }

    // The app does nothing in the background: when it leaves the screen (another app, screen off) both
    // sessions are marked inactive, so the game page stops animating and its timers are throttled by the
    // web engine. They are woken again as soon as the app is visible. (A running automation therefore
    // only makes progress while the app is on screen.)
    override fun onStart() {
        super.onStart()
        gameSession.setActive(true)
        helperSession.setActive(true)
    }

    override fun onStop() {
        gameSession.setActive(false)
        helperSession.setActive(false)
        super.onStop()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (showingGame) {
            // game view on top: just go back to helper instead of leaving the app
            showHelper()
        } else {
            moveTaskToBack(true)
        }
    }
}
