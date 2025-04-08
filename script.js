'use strict';

class Workout {
  date = new Date();
  id = Date.now().toString().slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

////////////////////////////////////////////////
// APPILICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const removeAllWorkouts = document.querySelector('.remove__all--workouts');
const closeFormBtn = document.querySelector('.close__form--btn');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #isEditing = false;
  #editingWorkoutId;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._submitOptions.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._workoutOptions.bind(this)
    );

    removeAllWorkouts.addEventListener(
      'click',
      this._removeAllWorkouts.bind(this)
    );
    closeFormBtn.addEventListener('click', this._closeForm.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(el => {
      this._renderWorkoutMarker(el);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }
  _closeForm() {
    form.classList.add('hidden');
    inputDistance.blur();

    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    this.#isEditing = false;
    this.#mapEvent = '';
    this.#editingWorkoutId = '';
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }
  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from the form

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If activity running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(duration, distance, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(duration, distance, elevation) ||
        !allPositive(duration, distance)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);
    // Render workout on list
    this._renderWorkout(workout);

    //Hide form + Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    if (this.#isEditing) {
      const markerIndex = this.#markers.findIndex(
        marker => marker.id === workout.id
      );

      this.#markers.splice(markerIndex, 1, { id: workout.id, marker });
      return;
    }
    this.#markers.push({ id: workout.id, marker });
  }

  _renderWorkout(workout, id) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__btn--container">
            <button class="workout--btn btn--edit">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class=" btn--svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
            </button>
            <button class="workout--btn btn--delete">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class=" btn--svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'running')
      html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;

    if (this.#isEditing) {
      document.querySelector(`[data-id="${id}"]`).outerHTML = html;
      return;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _submitOptions(e) {
    if (this.#isEditing) {
      this._submitEditedWorkout(e);
      return;
    }
    this._showRemoveAll();

    this._newWorkout(e);
  }

  _workoutOptions(e) {
    if (e.target.closest('.btn--delete')) {
      this._removeWorkout(e);
      return;
    }

    if (e.target.closest('.btn--edit')) {
      this._showEditForm(e);
    }

    this._moveToPopup(e);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(el => el.id === workoutEl.dataset.id);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map(this._recreateLocalStorageObj.bind(this));

    this.#workouts.forEach(el => {
      this._renderWorkout(el);
    });

    this._showRemoveAll();
  }

  _setConstants(mainObj, resultObj) {
    resultObj.date = new Date(mainObj.date);
    resultObj.id = mainObj.id;
    resultObj.clicks = mainObj.clicks;
    resultObj._setDescription();
    if (resultObj.type === 'running') {
      resultObj.calcPace();
    }
    if (resultObj.type === 'cycling') {
      resultObj.calcSpeed();
    }
  }

  _recreateLocalStorageObj(work) {
    if (work.type === 'running') {
      const result = new Running(
        work.coords,
        work.distance,
        work.duration,
        work.cadence
      );
      this._setConstants(work, result);
      return result;
    }

    if (work.type === 'cycling') {
      const result = new Cycling(
        work.coords,
        work.distance,
        work.duration,
        work.elevationGain
      );
      this._setConstants(work, result);
      return result;
    }
  }

  _showEditForm(e) {
    this.#isEditing = true;
    this._showForm();
    this.#editingWorkoutId = +e.target.closest('.workout').dataset.id;
  }

  _submitEditedWorkout(e) {
    e.preventDefault();
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    const workoutIndex = this.#workouts.findIndex(
      work => +work.id === this.#editingWorkoutId
    );

    const selectedWorkout = this.#workouts.at(workoutIndex);
    const selectedWorkoutMarker = this.#markers.find(
      marker => marker.id === selectedWorkout.id
    ).marker;

    let workoutEdited;
    if (type === 'running') {
      const cadence = +inputCadence.value;

      workoutEdited = new Running(
        selectedWorkout.coords,
        distance,
        duration,
        cadence
      );
    }
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      workoutEdited = new Cycling(
        selectedWorkout.coords,
        distance,
        duration,
        elevation
      );
    }

    this._setConstants(selectedWorkout, workoutEdited);
    this.#workouts.splice(workoutIndex, 1, workoutEdited);
    this._renderWorkout(workoutEdited, workoutEdited.id);
    this.#map.removeLayer(selectedWorkoutMarker);
    this._renderWorkoutMarker(workoutEdited);
    this._hideForm();
    this._setLocalStorage();
    this.#isEditing = false;
  }

  _removeWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    const workoutElId = workoutEl.dataset.id;
    workoutEl.remove();
    const workoutElIndex = this.#workouts.findIndex(
      work => work.id === workoutElId
    );
    this.#map.removeLayer(
      this.#markers.find(work => work.id === workoutElId).marker
    );
    this.#workouts.splice(workoutElIndex, 1);

    this._setLocalStorage();
    if (!this.#workouts.length) this._hideRemoveAll();
  }

  _showRemoveAll() {
    removeAllWorkouts.style.display = 'block';
    form.removeEventListener('submit', this._showRemoveAll);
  }

  _hideRemoveAll() {
    removeAllWorkouts.style.display = 'none';
  }
  _removeAllWorkouts(e) {
    const removeBtn = e.target.closest('.remove__all--workouts');
    if (!removeBtn) return;
    this._hideRemoveAll();
    [...containerWorkouts.children].forEach(el => {
      if (el.classList.contains('form')) return;
      el.remove();
    });
    this.#markers.forEach(mark => this.#map.removeLayer(mark.marker));
    this.#workouts = [];
    this._setLocalStorage();
  }
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
