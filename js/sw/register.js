/* Register Service Worker */
if ('serviceWorker' in navigator) {
	navigator.serviceWorker
		.register('sw.js')
		.then(registration => {
			console.log("Service worker registration successful: " + registration.scope);
		})
		.catch(error => {
			console.log('Registration failed: ' + error);
		});
}
