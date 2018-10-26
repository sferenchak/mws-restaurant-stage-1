let restaurant;
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
  const imgUrlFromDB = DBHelper.imageUrlForRestaurant(restaurant);
  //const imgUrlParts = imgUrlFromDB.split('.');
  const imgUrl1x = imgUrlFromDB + '_banner_' + '@1x.jpg';
  const imgUrl2x = imgUrlFromDB + '_banner_' + '@2x.jpg';
  image.src = imgUrl1x;
  image.srcset = `${imgUrl1x} 1x, ${imgUrl2x} 2x`;
  image.alt = restaurant.name + ' restaurant promotional'

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // Fetch restaurant reviews
  DBHelper.fetchRestaurantReviews(restaurant, (error, reviews) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      // fill reviews
      fillReviewsHTML(reviews);
    }
  });
  
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);

  // Create form for submitting new Reviews
  const form = document.createElement('form');
  form.method = 'POST';

  form.innerHTML = `<h3>Add a Review</h3>
  <fieldset>
  <div>
    <label for="name">Name:</label>
    <input type="text" id="name" name="name">
  </div>
  <div>
    <label for="rating">Rating:</label>
    <input type="number" id="rating" name="rating" step="1" min="0" max="5" placeholder="Rating from 0-5">
  </div>
  <div>
    <label for="comments">Comment:</label>
    <textarea id="comments" name="comments"></textarea>
  </div>
  <button id="submitReview" type="submit">Submit</button>
  </fieldset>`
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const rating = document.getElementById('rating').value;
    const comments = document.getElementById('comments').value;
    if (name !== "" && rating !== "" && comments !== "") {
      const params = {
        'restaurant_id': self.restaurant.id,
        name,
        rating,
        comments
      }
      DBHelper.sendRestaurantReview(params, (error, review) => {
        if (error) {
          console.log('Error sending Review');
        }
        const btn = document.getElementById('submitReview');
        btn.setAttribute('disabled', false);
        console.log(`Review from sendRestaurantReview():`);
        console.log(review);
        window.location.href = `/restaurant.html?id=${self.restaurant.id}`;
      })
    } else {
      //TODO: handle invalid form
    }
  });
  container.appendChild(form);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  const dateCreated = new Date(review.createdAt);
  date.innerHTML = dateCreated.toLocaleDateString('en-US');
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.setAttribute('aria-current', 'page');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
