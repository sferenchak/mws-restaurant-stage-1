var staticCacheName = 'restaurant-static-v1';

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(staticCacheName)
			.then(cache => {
				return cache.addAll([
					'/',
					'/index.html',
					'/restaurant.html',
					'/css/normalize.css',
					'/css/styles.css',
					'/data/restaurants.json',
					'/js/dbhelper.js',
					'/js/main.js',
					'/js/restaurant_info.js',
					'/js/sw/register.js',
					'/img/placeholder.jpg'
				])
					.catch(error => {
						console.log("Failed to open cache: " + error);
					});
			})
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys()
			.then(cacheNames => {
				return Promise.all(
					cacheNames.filter(cacheName => {
						return cacheName.startsWith('restaurant-') &&
							cacheName != staticCacheName;
					}).map(cacheName => {
						return caches.delete(cacheName);
					})
				);
			})
	);
});

self.addEventListener('fetch', event => {
	let cacheRequest = event.request;
	let requestUrl = new URL(event.request.url);

	console.log('Handling fetch event for', requestUrl);

	if (requestUrl.hostname !== 'localhost') {
		event.request.mode = 'no-cors';
	}
 	if (requestUrl.origin !== location.origin) {
		console.log("Skipping non-same-origin item", requestUrl);
		return;
	}
	if (requestUrl.href.indexOf('restaurant.html') > -1) {
		const cacheUrl = 'restaurant.html';
		cacheRequest = new Request(cacheUrl);
	}
	event.respondWith(
		caches.match(cacheRequest)
			.then(response => {
				if (response) {
					console.log('Found response in cache:', response);
					return response
				}

				console.log('Fetching request from the network');
				return fetch(cacheRequest)
						.then(fetchResponse => {
							return caches.open(staticCacheName)
								.then(cache => {
									cache.put(cacheRequest, fetchResponse.clone());
									return fetchResponse;
								})
						})
						.catch(error => {
							if (requestUrl.href.indexOf('*.jpg') === -1) {
								return caches.match('/img/placeholder.jpg');
							}
							return new Response('You are not connected to the internet', {
								status: 404,
								statusText: 'You are not connected to the internet'
							})
						})
			})
	);
});