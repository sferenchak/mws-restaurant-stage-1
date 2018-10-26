importScripts('js/idb.js');

var staticCacheName = 'restaurant-static-v1';
const staticDBName = 'restaurant-store';
const dbVersion = 1;
const dbStoreName = 'restaurants';

const dbPromise = idb.open(staticDBName, dbVersion, upgradeDB => {
  switch (upgradeDB.oldVersion) {
    case 0:
      upgradeDB.createObjectStore(dbStoreName, { keyPath: 'id' });
    case 1:
      upgradeDB.createObjectStore('reviews', { keyPath: 'id' })
        .createIndex('reviewsByRestaurant_id', 'restaurant_id');
  }
});

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
  let requestUrl = new URL(cacheRequest.url);
  if (requestUrl.hostname !== 'localhost') {
    event.mode = 'no-cors';
  }
  if (requestUrl.href.indexOf('restaurant.html') > -1) {
    const cacheUrl = 'restaurant.html';
    cacheRequest = new Request(cacheUrl);
  }

  // If the request is going to API server leverage IDB else send to Cache
  const checkURL = new URL(event.request.url);
  if (checkURL.port === '1337') {
    const parts = checkURL.pathname.split('/');
    let id = parts[parts.length - 1] === 'restaurants' ? '-1' : parts[parts.length - 1];
    if (checkURL.search.includes('is_favorite')) {
      id = parts[parts.length - 2];
    }
    if (checkURL.search.includes('restaurant')) {
      id = Number(checkURL.search.split('=').pop());
      sendToReviewDB(event, id);
      return;
    }
    if (parts[parts.length - 1] === 'reviews') {
      //TODO: Handle these review posts if offline
      console.log(`Sent a review!`);
      return;
    }
    sendToRestaurantDB(event, id);
  } else {
    sendToCache(event, cacheRequest);
  }
});

const sendToReviewDB = (event, id) => {
  event.respondWith(
    dbPromise.then(db => {
      return db.transaction('reviews')
        .objectStore('reviews')
        .index('reviewsByRestaurant_id')
        .getAll(id);
    })
      .then(data => {
        console.log(data);
        return (
          //TODO: figure out how to send back out the data properly
          // data gives an "an object that was not a Response was passed to respondWith()."" error...
          (data) ||
          fetch(event.request)
            .then(fetchResponse => fetchResponse.json())
            .then(json => {
              return dbPromise.then(db => {
                const tx = db.transaction('reviews', 'readwrite');
                const newJson = json.map(obj => {
                  let temp = Object.assign({}, obj);
                  temp.restaurant_id = Number(temp.restaurant_id);
                  return temp;
                });
                newJson.forEach(review => {
                  tx.objectStore('reviews').put(review);
                })
                console.log(newJson);
                return newJson;
              });
            })
            .then(finalResponse => {
              return new Response(JSON.stringify(finalResponse));
            })
            .catch(error => {
              return new Response(`Error fetching review data: ${error}`, { status: 500 });
            })
        )
      })
  )
};

const sendToRestaurantDB = (event, id) => {
  event.respondWith(
    dbPromise.then(db => {
      return db.transaction('restaurants')
        .objectStore(dbStoreName)
        .get(id);
    })
      .then(data => {
        return (
          (data && data.data) ||
          fetch(event.request)
            .then(fetchResponse => fetchResponse.json())
            .then(json => {
              return dbPromise.then(db => {
                const tx = db.transaction('restaurants', 'readwrite');
                tx.objectStore('restaurants').put({
                  id: id,
                  data: json
                });
                return json;
              });
            })
        );
      })
      .then(finalResponse => {
        return new Response(JSON.stringify(finalResponse));
      })
      .catch(error => {
        return new Response(`Error fetching data: ${error}`, { status: 500 });
      })
  )
};

const sendToCache = (event, cacheRequest) => {
  event.respondWith(
    caches.match(cacheRequest)
      .then(response => {
        if (response) {
          return response
        }

        return fetch(cacheRequest)
          .then(fetchResponse => {
            return caches.open(staticCacheName)
              .then(cache => {
                cache.put(cacheRequest, fetchResponse.clone());
                return fetchResponse;
              })
          })
          .catch(error => {
            if (cacheRequest.url.href.indexOf('*.jpg') === -1) {
              return caches.match('/img/placeholder.jpg');
            }
            return new Response('You are not connected to the internet', {
              status: 404,
              statusText: 'You are not connected to the internet'
            })
          })
      })
  );
};