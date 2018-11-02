importScripts('js/idb.js');

Array.prototype.isArray = true;
const staticCacheName = 'restaurant-static-v1';
const staticDBName = 'restaurant-store';
const dbVersion = 3;
let form_params;

const dbPromise = idb.open(staticDBName, dbVersion, upgradeDB => {
  switch (upgradeDB.oldVersion) {
    case 0:
      upgradeDB.createObjectStore('restaurants', { keyPath: 'id' });
    case 1:
      upgradeDB.createObjectStore('reviews', { keyPath: 'id' })
        .createIndex('reviewsByRestaurant_id', 'restaurant_id');
    case 2:
      upgradeDB.createObjectStore('offlineReview', { autoIncrement: true });
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

self.addEventListener('message', event => {
  if (event.data.hasOwnProperty('form_params')) {
    form_params = event.data.form_params;
  }
  if (event.data.hasOwnProperty('restaurant')) {
    
  }
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
    let id = parts[parts.length - 1] === 'restaurants' ? -1 : parseInt(parts[parts.length - 1]);
    // trying to toggle is_favorite
    if (checkURL.search.includes('is_favorite')) {
      id = parseInt(parts[parts.length - 2]);
    }
    // if url is looking for the reviews for a restaurant, send them
    // to the reviews DB and make sure to send the id as a Number
    if (checkURL.search.includes('restaurant_id')) {
      id = parseInt(checkURL.search.split('=').pop());
      sendToReviewDB(event, id);
      return;
    }
    // Posting a review
    if (event.request.method === 'POST') {
      sendToTempReviewDB(event);
      return;
    }
    sendToRestaurantDB(event, id);
  } else {
    sendToCache(event, cacheRequest);
  }
});

const sendToTempReviewDB = (event) => {
  event.respondWith(
    fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(finalResponse => {
        return new Response(JSON.stringify(finalResponse));
      })
      .catch(error => {
        // add to IDB if fetch errors out
        dbPromise.then(db => {
          const tx = db.transaction('offlineReview', 'readwrite');
          tx.objectStore('offlineReview').put(form_params);
          return new Response(`Error posting review data: ${error}. Added to IDB.`, { status: 500 });
        })
      })
  )
};

const sendToReviewDB = (event, id) => {
  event.respondWith(
    dbPromise.then(db => {
      // get all restaurants for the restaurant_id passed in
      return db.transaction('reviews')
        .objectStore('reviews')
        .index('reviewsByRestaurant_id')
        .getAll(id);
    })
      .then(data => {
        return (
          (data && data.length > 0 ? data : false) ||
          fetch(event.request)
            .then(fetchResponse => fetchResponse.json())
            .then(json => {
              return dbPromise.then(db => {
                const tx = db.transaction('reviews', 'readwrite');
                const newJson = json.map(obj => {
                  let temp = Object.assign({}, obj);
                  temp.restaurant_id = parseInt(temp.restaurant_id);
                  return temp;
                });
                newJson.forEach(review => {
                  tx.objectStore('reviews').put(review);
                })
                return newJson;
              });
            })
        );
      })
      .then(finalResponse => {
        return new Response(JSON.stringify(finalResponse));
      })
      .catch(error => {
        return new Response(`Error fetching review data: ${error}`, { status: 500 });
      })
  )
};

const sendToRestaurantDB = (event, id) => {
  event.respondWith(
    dbPromise.then(db => {
      if (id < 0) {
        return db.transaction('restaurants')
          .objectStore('restaurants')
          .getAll();
      } else {
        return db.transaction('restaurants')
          .objectStore('restaurants')
          .get(parseInt(id));
      }
    })
      .then(data => {
        return (
          // if the data is an array AND has length > 1 OR data.id exists 
          // send back data from IDB, otherwise go to network
          (data && (data.isArray && data.length > 1) || data && data.id ? data : false) ||
          fetch(event.request)
            .then(fetchResponse => fetchResponse.json())
            .then(json => {
              return dbPromise.then(db => {
                const tx = db.transaction('restaurants', 'readwrite');
                // don't store all restaurants as a single entry
                if (id < 0) {
                  json.forEach(restaurant => {
                    tx.objectStore('restaurants').put(restaurant);
                  })
                } else {
                  tx.objectStore('restaurants').put(json);
                }
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