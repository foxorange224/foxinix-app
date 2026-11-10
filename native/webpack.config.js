const webpack = require("@nativescript/webpack");

module.exports = (env) => {
	webpack.init(env);

	/* W106: los comentarios del template hacen que la RAÍZ de un componente
	   sea un Fragment en vez de un elemento.

	   En desarrollo Vue lo desenvuelve (código de desarrollo: resolveDevRootEl
	   + el flag DEV_ROOT_FRAGMENT) y $el apunta al elemento real. En
	   producción NO lo hace: $el queda siendo el ancla del fragmento, que no
	   tiene vista nativa, y la app se queda EN NEGRO (la APK publicada se
	   quedaba en negro al abrirla).

	   Por eso los comentarios del template no se compilan: la raíz tiene que
	   ser un elemento de verdad, igual en depuración y en producción. */
	webpack.chainWebpack((config) => {
		config.module
			.rule("vue")
			.use("vue-loader")
			.tap((options) => ({
				...options,
				compilerOptions: {
					...(options.compilerOptions || {}),
					comments: false,
				},
			}));
	}, { order: 100 });

	const config = webpack.resolveConfig();

	/* W106: en producción el webpack de NativeScript borra TODOS los
	   console.* (drop_console). Pero nativescript-vue atrapa los errores
	   de Vue y SÓLO los relanza en desarrollo (__DEV__), así que un error
	   al renderizar dejaba la app en negro y sin una sola línea en el
	   logcat (no había forma de saber qué había pasado).

	   Acá se conservan console.error y console.warn (se borran sólo log,
	   debug e info, que no aportan nada en producción). Con eso, cualquier
	   error de la app queda escrito en el logcat del dispositivo. */
	for (const plugin of (config.optimization && config.optimization.minimizer) || []) {
		const compress = plugin &&
			plugin.options &&
			plugin.options.minimizer &&
			plugin.options.minimizer.options &&
			plugin.options.minimizer.options.compress;
		if (compress && compress.drop_console) {
			compress.drop_console = ["log", "debug", "info"];
		}
	}

	return config;
};
