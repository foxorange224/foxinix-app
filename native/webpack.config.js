const webpack = require("@nativescript/webpack");

module.exports = (env) => {
	webpack.init(env);

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
