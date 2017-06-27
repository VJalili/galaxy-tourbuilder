import ext from './utils/ext';
import storage from './utils/storage';
import { path as getPath, toggleClass } from './utils/dom';
import { ACTION_ENABLE } from './actions';
import { createPanel } from './utils/html';
import GalaxyTour from './tour';

let tour = new GalaxyTour();
let recording = false;

document.querySelector('body').addEventListener('click', event => {
  const $configurator = document.querySelector('#tour-configurator');

  if ('tour-toggle' === event.target.id) {
    toggleClass($configurator, 'hidden');
    return;
  }

  if ('tour-reset' === event.target.id) {
    tour = new GalaxyTour();
    storage.set({ tour: tour.toYAML() }, () => {
      $configurator.querySelector('textarea').value = tour.toYAML();
    });
    return;
  }

  if ('tour-update' === event.target.id) {
    tour.fromYAML($configurator.querySelector('textarea').value);
    storage.set({ tour: tour.toYAML() }, () => {});
    return;
  }

  if ('tour-record' === event.target.id) {
    toggleClass(document.querySelector('#tour-record'), 'recording');
    recording = !recording;
    return;
  }

  if ('tour-run' === event.target.id) {
    const script = document.createElement('script');
    const jsonSteps = JSON.stringify(tour.getStepsForInjection(), (k, v) => {
      if (typeof v === 'function') {
        return `(${v})`;
      }
      return v;
    });

    script.textContent = `
    (function (window, $) {
      function parse(obj) {
        return JSON.parse(obj, (k, v) => {
          if (typeof v === 'string' && v.indexOf('function') >= 0) {
            return eval(v);
          }
          return v;
        });
      }

      var tour = new window.Tour({
        steps: parse(${JSON.stringify(jsonSteps)}),
      }, {
        orphan: true,
        delay: 150,
      });

      tour.init();
      tour.goTo(0);
      tour.restart();
    })(window, jQuery);
    `;

    (document.head || document.documentElement).appendChild(script);
    script.remove();

    return;
  }

  const path = getPath(event.target, document.origin);

  if (
    !recording ||
    path === '' ||
    /(tour-configurator|popover-|tour-|uid)/.test(path) ||
    // exclude menu sections
    /title_/.test(path)
  ) {
    return;
  }

  tour.addStep(path);
  storage.set({ tour: tour.toYAML() }, () => {
    $configurator.querySelector('textarea').value = tour.toYAML();
  });
});

ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let $configurator = document.querySelector('#tour-configurator');

  if (request.action === ACTION_ENABLE) {
    if (request.value === true) {
      storage.get('tour', res => {
        if (res.tour) {
          tour.fromYAML(res.tour);
        }

        if (!$configurator) {
          document.body.appendChild(createPanel());
          $configurator = document.querySelector('#tour-configurator');
        }

        $configurator.querySelector('textarea').value = tour.toYAML();
      });
    } else if ($configurator) {
      $configurator.parentNode.removeChild($configurator);
    }
  }
});
