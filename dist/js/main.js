let restaurants,
  neighborhoods,
  cuisines
var map
var markers = []

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();
}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');
  const figure = document.createElement('figure');
  li.append(figure);

  // Setup images
  const image = document.createElement('img');
  image.className = 'restaurant-img';
  const imgUrlFromDB = DBHelper.imageUrlForRestaurant(restaurant);
  const imgUrl1x = imgUrlFromDB + '@1x.jpg';
  const imgUrl2x = imgUrlFromDB + '@2x.jpg';
  image.src = imgUrl1x;
  image.srcset = `${imgUrl1x} 1x, ${imgUrl2x} 2x`;
  image.alt = restaurant.name + ' restaurant promotional image'
  figure.append(image);

  // Setup caption area below image
  const figcaption = document.createElement('figcaption');
  figcaption.className = 'restaurant-information';
  figure.append(figcaption);

  // Add the name of the restaurant to the caption
  const name = document.createElement('h2');
  name.innerHTML = restaurant.name;
  figcaption.append(name);

  // Add the Neighborhood to the caption
  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  figcaption.append(neighborhood);

  // Add the Address to the caption
  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  figcaption.append(address);
  
  // Add the button wrapper
  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'button-wrapper';
  figcaption.append(buttonWrapper);

  // Add the button that brings the user to the restaurant info page
  const more = document.createElement('button');
  more.innerHTML = 'View Details';
  more.setAttribute('aria-label', `View Details for ${restaurant.name}`);
  more.onclick = () => {
    const url = DBHelper.urlForRestaurant(restaurant);
    window.location = url;
  }
  buttonWrapper.append(more)

  // Add Favorite button
  const favorite = document.createElement('button');
  if (restaurant.is_favorite.toString() == 'false') {
    favorite.innerHTML = 'Favorite ☆';
    favorite.setAttribute('aria-label', `Set ${restaurant.name} as a favorite`)
  } 
  else {
    favorite.innerHTML = 'Unfavorite ★';
    favorite.setAttribute('aria-label', `Remove ${restaurant.name} from favorites`);
  }
  favorite.onclick = (event) => {
    restaurant.is_favorite = (restaurant.is_favorite.toString() == 'false') ? 'true' : 'false';
    DBHelper.toggleFavoriteRestaurant(restaurant, (error, restaurant) => {
      if (error) { // Got an error!
        console.error(error);
      } else {
        updateFavoriteUI(event, restaurant)
      }
    })
  }
  buttonWrapper.append(favorite);
  
  return li
}

/**
 * Update favorite UI when toggled
 */
updateFavoriteUI = (event, restaurant) => {
  if (restaurant.is_favorite == 'false') {
    event.target.innerHTML = 'Favorite ☆';
    event.target.setAttribute('aria-label', `Set ${restaurant.name} as a favorite`)
  }
  else {
    event.target.innerHTML = 'Unfavorite ★';
    event.target.setAttribute('aria-label', `Remove ${restaurant.name} from favorites`);
  }
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
}
