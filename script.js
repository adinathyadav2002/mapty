'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputSort = document.querySelector('.sort__input--type');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
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
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.type = 'running';
    this._setDescription();
    this.calcPace();
  }

  calcPace() {
    this.pace = this.duration / this.distance; // in min/km
    return this.pace;
  }
}

class Cycling extends Workout {
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.type = 'cycling';
    this._setDescription();
    this.calcPace();
  }

  calcPace() {
    this.pace = this.distance / (this.duration / 60); // in km/ht
    return this.pace;
  }
}

const validInput = (...inputs) => inputs.every(input => Number.isFinite(input));
const isPositive = (...inputs) => inputs.every(input => input > 0);
// to store the
let editType, editCadence, editDistance, editDuration, editElevation;
// ///////////////////////////////
// APP ARCHITECTURE
class App {
  #map;
  #evt;
  #zoomLevel = 13;
  #workouts = [];

  #currentEditing = -1;

  constructor() {
    this._getPosition();

    // we want to point this to app not to form
    form.addEventListener('submit', this._newWorkout.bind(this));

    // event to toggle form element from elevation gain to cadence
    inputType.addEventListener('change', this._toggleElevationField);

    // event delegation to handle mutiple events
    containerWorkouts.addEventListener(
      'click',
      this._eventsOnListItem.bind(this)
    );

    // event listener for change in select
    inputSort.addEventListener('change', this._sortWorkouts.bind(this));

    // event that will trigger before closing the page
    window.addEventListener(
      'beforeunload',
      function (e) {
        this.#workouts.sort((a, b) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        localStorage.clear();
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
      }.bind(this)
    );
  }

  _eventsOnListItem(e) {
    // listener for discard button (click) to discard
    // changes from the workout form

    if (e.target.classList.contains('discard-btn')) {
      this.#currentEditing.style.display = 'grid';
      const formEdit = document.querySelector('.form__edit');
      formEdit.remove();
      this.#currentEditing = -1;
      return;
    }

    // listener for save the changes of the workout form
    if (e.target.classList.contains('save-btn')) {
      this._saveEditedWorkout(e);
      return;
    }

    // listener to remove the workout
    if (e.target.classList.contains('close-btn')) {
      // remove the clicked workout from this.#workouts
      const res = confirm('Remove the workout');
      if (!res) return;
      const id = e.target.closest('.workout').dataset.id;
      const newWorkouts = this.#workouts.filter(workout => workout.id != id);
      this.#workouts = newWorkouts;

      // remove markers and workouts
      this._removeAllMarkersAndWorkouts();

      // render all markers and workouts
      this.#workouts.forEach(workout => this._renderAllWorkout(workout));
      return;
    }

    // listener to edit the workout
    if (e.target.classList.contains('edit-btn')) {
      if (this.#currentEditing !== -1) {
        alert('first save the changes of opened workout');
        return;
      }
      e.target.closest('.workout').style.display = 'none';
      this.#currentEditing = e.target.closest('.workout');

      this._renderEditForm(e);

      editType = document.querySelector('.form__edit--type');
      editCadence = document.querySelector('.form__edit--cadence');
      editElevation = document.querySelector('.form__edit--elevation');

      editType.addEventListener('change', () => {
        editCadence.closest('.form__row').classList.toggle('form__row--hidden');
        editElevation
          .closest('.form__row')
          .classList.toggle('form__row--hidden');
      });

      editType
        .closest('.form__edit')
        .addEventListener('submit', this._saveEditedWorkout.bind(this));
    }

    // otherwise move to current workout on map

    this._focusOnLocation(e);
  }

  _saveEditedWorkout(e) {
    e.preventDefault();
    editDistance = document.querySelector('.form__edit--distance');
    editDuration = document.querySelector('.form__edit--duration');
    editType = document.querySelector('.form__edit--type');
    editCadence = document.querySelector('.form__edit--cadence');
    editElevation = document.querySelector('.form__edit--elevation');

    const dis = Number(editDistance.value),
      dur = Number(editDuration.value),
      cad = Number(editCadence.value),
      ele = Number(editElevation.value);

    if (editType.value === 'running') {
      if (!validInput(dis, dur, cad) || !isPositive(dis, dur, cad))
        return alert('Input have to be positive number');
    } else {
      if (!validInput(dis, dur, ele) || !isPositive(dis, dur))
        return alert('Input have to be positive number');
    }

    const id = this.#currentEditing.closest('.workout').dataset.id;

    this.#workouts.forEach((wk, i) => {
      if (wk.id === id && wk.type === editType.value) {
        wk.duration = editDuration.value;
        wk.distance = editDistance.value;

        if (wk.type === 'running') wk.cadence = editCadence.value;
        else wk.elevation = editElevation.value;
      } else if (wk.id === id) {
        let wkt;
        if (editType.value === 'running') {
          wkt = new Running([...wk.coords], dis, dur, cad);
        } else {
          wkt = new Cycling([...wk.coords], dis, dur, ele);
        }
        this.#workouts[i] = wkt;
      }
    });
    this.#currentEditing.style.display = 'grid';

    // remove the edit form
    const formEdit = document.querySelector('.form__edit');
    formEdit.remove();

    // remove all markers and workouts
    this._removeAllMarkersAndWorkouts();

    // render all the workouts and markers again
    this.#workouts.forEach(workout => this._renderAllWorkout(workout));

    this.#currentEditing = -1;
  }

  _removeAllMarkersAndWorkouts() {
    const workoutList = document.querySelectorAll('.workout');
    workoutList.forEach(workout => workout.remove());
    this.#map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        this.#map.removeLayer(layer);
      }
    });
  }

  _renderLocaleStorage() {
    this.#workouts = !JSON.parse(localStorage.getItem('workouts'))
      ? []
      : JSON.parse(localStorage.getItem('workouts'));
    this.#workouts?.forEach(workout => {
      this._renderAllWorkout(workout);
    });
  }

  _renderAllWorkout(workout) {
    // render marker
    this._renderMarker(workout);

    // render workouts
    this._renderWorkout(workout);

    // add workout to local storage
    this._addToLocal(workout);

    // clear form and hide form
    this._hideForm();
  }

  _getPosition() {
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      function () {
        alert('Some error occured while fetching current location ');
      }
    );
  }

  _loadMap(position) {
    // const { latitude, longitude } = position.coords;

    const latitude = 18.211778;
    const longitude = 76.455029;

    this.#map = L.map('map').setView([latitude, longitude], this.#zoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this._renderLocaleStorage();

    this.#map.on('click', this._showForm.bind(this));
  }

  _showForm(ev) {
    this.#evt = ev;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    // get input data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#evt.latlng;

    let workout;

    // check input values depending upon excercise
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)

        // use function instead
        !validInput(distance, duration, cadence) ||
        !isPositive(distance, duration, cadence)
      )
        return alert('Input have to be positive number');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // TODO: FROM VALIDATION
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInput(distance, duration, elevation) ||
        !isPositive(distance, duration)
      )
        return alert('Input have to be positive number');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    this.#workouts.push(workout);
    this._renderAllWorkout(workout);
  }

  _addToLocal() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _hideForm() {
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputElevation.value = inputCadence.value ='';
    form.classList.add('hidden');
    form.style.display = 'none';

    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _renderMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          autoClose: false,
          className: `${workout.type}-popup`,
          closeOnClick: false,
        }).setContent(`${workout.description}`)
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
    <div class="workout__title-div">
      <h2 class="workout__title">${workout.description}</h2>
        <div class="closeEdit__buttons">
          <button type="button" class="edit-btn">✏️</button>
          <button type="button" class="close-btn">❌</button>
        </div>
        </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃🏼' : '🚴🏼'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'cycling') {
      html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;
    }
    if (workout.type === 'running') {
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
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _focusOnLocation(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const wk = this.#workouts.find(work => workoutEl.dataset.id === work.id);

    this.#map.setView(wk.coords, this.#zoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    // TODO: will not work because object or string got from the local storage
    // will not have prototype chain
    // wk.click();
  }

  _renderEditForm(e) {
    const id = this.#currentEditing.dataset.id;
    let description;
    this.#workouts.forEach(workout => {
      if (workout.id === id) {
        description = workout.description;
      }
    });
    const html = `<form class="form__edit">
        <div class="workout__title-div">
          <h2 class="workout__title">${description}</h2>
          <div class="closeEdit__buttons">
            <button type="button" class="discard-btn">❎</button>
            <button type="button" class="save-btn">✅</button>
          </div>
        </div>
        <div class="form__row">
          <label class="form__label">Type</label>
          <select class="form__input form__edit--type">
            <option value="running">Running</option>
            <option value="cycling">Cycling</option>
          </select>
        </div>
        <div class="form__row">
          <label class="form__label">Distance</label>
          <input class="form__input form__edit--distance" placeholder="km" />
        </div>
        <div class="form__row">
          <label class="form__label">Duration</label>
          <input class="form__input form__edit--duration" placeholder="min" />
        </div>
        <div class="form__row">
          <label class="form__label">Cadence</label>
          <input class="form__input form__edit--cadence" placeholder="step/min" />
        </div>
        <div class="form__row form__row--hidden">
          <label class="form__label">Elev Gain</label>
          <input class="form__input form__edit--elevation" placeholder="meters" />
        </div>
        <button class="form__btn">OK</button>
      </form>
  `;

    e.target.closest('.workout').insertAdjacentHTML('afterend', html);
  }

  _sortWorkouts(e) {
    e.preventDefault();
    if (e.target.value === 'distance') {
      this.#workouts.sort((a, b) => a.distance - b.distance);
    } else if (e.target.value === 'duration') {
      this.#workouts.sort((a, b) => a.duration - b.duration);
    } else if (e.target.value === 'time') {
      this.#workouts.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    } else {
      this.#workouts.sort((a, b) => a.pace - b.pace);
    }

    // remove all markers and workouts
    this._removeAllMarkersAndWorkouts();

    // render all the workouts and markers again
    this.#workouts.forEach(workout => this._renderAllWorkout(workout));
  }

  clear() {
    localStorage.clear();
  }
}

const app = new App();
