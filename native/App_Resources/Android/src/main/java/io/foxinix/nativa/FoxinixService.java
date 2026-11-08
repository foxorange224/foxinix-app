package io.foxinix.nativa;

/* FoxinixService — servicio en primer plano (W101).
 *
 * PROBLEMA:
 *   La app nativa (NativeScript) recibe los mensajes por un WebSocket que
 *   vive en el runtime de JavaScript. Si Android mata el proceso (o lo
 *   congela) con la app en segundo plano, el socket se cae y no llega
 *   ningún aviso: el usuario se queda sin enterarse de los mensajes.
 *
 * SOLUCIÓN (sin Firebase):
 *   Un servicio en primer plano mantiene el proceso vivo y con prioridad
 *   de CPU, así que el WebSocket sigue conectado y los avisos del sistema
 *   (W100) se pueden mostrar.
 *
 * CÓMO SE USA:
 *   - La app lo arranca cuando va al segundo plano (Application.suspendEvent)
 *     y lo para cuando vuelve (Application.resumeEvent): en primer plano el
 *     proceso ya vive por sí solo y no hace falta molestar con el aviso
 *     persistente del servicio.
 *   - START_STICKY: si Android mata el proceso, el sistema vuelve a
 *     levantar el servicio (y con él la conexión).
 *
 * REQUISITOS (Android 14 / API 34+):
 *   - Tipo "specialUse" (no hay un tipo estándar para "mantener una
 *     conexión de mensajería") + la propiedad
 *     PROPERTY_SPECIAL_USE_FGS_SUBTYPE y el permiso
 *     FOREGROUND_SERVICE_SPECIAL_USE (declarados en el manifest).
 *   - El aviso del servicio va en un canal de importancia BAJA: sale
 *     silencioso, sin vibración y sin insignias.
 */

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class FoxinixService extends Service {

    /* Las acciones las arma service.ts con el nombre del paquete:
       io.foxinix.nativa.action.START / .STOP */
    public static final String ACTION_START = "io.foxinix.nativa.action.START";
    public static final String ACTION_STOP = "io.foxinix.nativa.action.STOP";
    public static final String CHANNEL_ID = "foxinix_background";
    private static final int NOTIFICATION_ID = 1001;

    /* Arranca el servicio (a prueba de que el sistema lo permita). */
    public static void start(Context ctx) {
        if (ctx == null) {
            return;
        }
        try {
            Intent i = new Intent(ctx, FoxinixService.class);
            i.setAction(ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Throwable t) {
            /* Android 12+ no deja arrancar un servicio en primer plano si
               la app está totalmente en segundo plano: se deja para el
               siguiente ciclo (la app vuelve a primer plano enseguida o
               el proceso sigue vivo igual). */
        }
    }

    /* Para el servicio (el aviso persistente desaparece solo). */
    public static void stop(Context ctx) {
        if (ctx == null) {
            return;
        }
        try {
            Intent i = new Intent(ctx, FoxinixService.class);
            i.setAction(ACTION_STOP);
            ctx.stopService(i);
        } catch (Throwable t) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            createChannel();
            /* La notificación del servicio tiene que salir YA (el sistema
               da 5 segundos); si no, Android mata la app. */
            startForeground(NOTIFICATION_ID, buildNotification());
        } catch (Throwable t) {
            stopSelf();
            return START_NOT_STICKY;
        }
        /* START_STICKY: si Android mata el proceso, el sistema vuelve a
           levantar el servicio (y la conexión con él). */
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        try {
            stopForeground(true);
        } catch (Throwable t) {
        }
        super.onDestroy();
    }

    /* Canal del aviso del servicio: importancia BAJA (silencioso, sin
       vibración, sin insignia). */
    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) {
                return;
            }
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID,
                    getString(R.string.foxinix_fg_title), NotificationManager.IMPORTANCE_LOW);
            ch.setDescription(getString(R.string.foxinix_fg_text));
            ch.setShowBadge(false);
            ch.enableVibration(false);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        } catch (Throwable t) {
        }
    }

    private Notification buildNotification() {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
            b.setPriority(Notification.PRIORITY_LOW);
        }
        b.setContentTitle(getString(R.string.foxinix_fg_title));
        b.setContentText(getString(R.string.foxinix_fg_text));
        b.setSmallIcon(R.drawable.ic_stat_notify);
        b.setOngoing(true);
        b.setShowWhen(false);
        b.setContentIntent(launchIntent());
        return b.build();
    }

    /* Al tocar el aviso del servicio se abre la app. */
    private PendingIntent launchIntent() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch == null) {
                launch = new Intent();
            }
            launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            return PendingIntent.getActivity(this, 0, launch, flags);
        } catch (Throwable t) {
            return null;
        }
    }
}
