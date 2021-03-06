/* @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {IS_IE11, IS_IOS} from '../../constants.js';
import {$openIOSARQuickLook, $openSceneViewer, ARInterface, ARMixin} from '../../features/ar.js';
import ModelViewerElementBase from '../../model-viewer-base.js';
import {Constructor, waitForEvent} from '../../utilities.js';
import {assetPath, spy, timePasses} from '../helpers.js';
import {BasicSpecTemplate} from '../templates.js';

const expect = chai.expect;

suite('ModelViewerElementBase with ARMixin', () => {
  suite('when registered', () => {
    let nextId = 0;
    let tagName: string;
    let ModelViewerElement: Constructor<ModelViewerElementBase&ARInterface>;

    setup(() => {
      tagName = `model-viewer-ar-${nextId++}`;
      ModelViewerElement = class extends ARMixin
      (ModelViewerElementBase) {
        static get is() {
          return tagName;
        }
      };
      customElements.define(tagName, ModelViewerElement);
    });

    BasicSpecTemplate(() => ModelViewerElement, () => tagName);

    suite('AR intents', () => {
      if (IS_IE11) {
        return;
      }
      let element: ModelViewerElementBase&ARInterface;
      let intentUrls: Array<string>;
      let restoreAnchorClick: () => void;

      setup(() => {
        element = new ModelViewerElement();
        document.body.insertBefore(element, document.body.firstChild);
        intentUrls = [];
        restoreAnchorClick = spy(HTMLAnchorElement.prototype, 'click', {
          value: function() {
            intentUrls.push((this as HTMLAnchorElement).href);
          }
        });
      });

      teardown(() => {
        if (element.parentNode != null) {
          element.parentNode.removeChild(element);
        }
        restoreAnchorClick();
      });

      suite('openSceneViewer', () => {
        test('preserves query parameters in model URLs', () => {
          element.src = 'https://example.com/model.gltf?token=foo';
          element.alt = 'Example model';
          (element as any)[$openSceneViewer]();

          expect(intentUrls.length).to.be.equal(1);

          const url = new URL(intentUrls[0]);

          expect(url.search).to.match(/(%3F|%26|&)token=foo(%26|&|$)/);
        });

        test('defaults title and link', () => {
          element.src = 'https://example.com/model.gltf';
          element.alt = 'alt';
          (element as any)[$openSceneViewer]();

          expect(intentUrls.length).to.be.equal(1);

          const url = new URL(intentUrls[0]);

          expect(url.search).to.match(/(%3F|%26|&)title=alt(%26|&|$)/);

          const linkRegex =
              `(%3F|%26|&)link=${self.location.toString()}(%26|&|$)`;
          linkRegex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          expect(url.search).to.match(new RegExp(linkRegex));
        });

        test('keeps title and link when supplied', () => {
          element.src = 'https://example.com/model.gltf?link=foo&title=bar';
          element.alt = 'alt';
          (element as any)[$openSceneViewer]();

          expect(intentUrls.length).to.be.equal(1);

          const url = new URL(intentUrls[0]);

          expect(url.search).to.match(/(%3F|%26|&)title=bar(%26|&|$)/);
          expect(url.search).to.not.match(/(%3F|%26|&)title=alt(%26|&|$)/);

          expect(url.search).to.match(/(%3F|%26|&)link=foo(%26|&|$)/);
          const linkRegex =
              `(%3F|%26|&)link=${self.location.toString()}(%26|&|$)`;
          linkRegex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          expect(url.search).to.not.match(new RegExp(linkRegex));
        });
      });

      suite('openQuickLook', () => {
        test('sets hash for fixed scale', () => {
          element.src = 'https://example.com/model.gltf';
          element.iosSrc = 'https://example.com/model.usdz';
          element.arScale = 'fixed';
          (element as any)[$openIOSARQuickLook]();

          expect(intentUrls.length).to.be.equal(1);

          const url = new URL(intentUrls[0]);

          expect(url.pathname).equal('/model.usdz');
          expect(url.hash).to.equal('#allowsContentScaling=0');
        });
      });
    });

    suite('quick-look-browsers', () => {
      // TODO(#624,#625): We cannot implement these tests without the ability
      // to mock our constants
      test('shows the AR button for allowed browsers');
      test('hides the AR button for non-allowed browsers');
    });

    suite('with webxr', () => {
      let element: ModelViewerElementBase&ARInterface;

      setup(async () => {
        element = new ModelViewerElement();
        document.body.insertBefore(element, document.body.firstChild);

        element.ar = true;
        element.arModes = 'webxr';
        element.src = assetPath('models/Astronaut.glb');

        await waitForEvent(element, 'load');
      });

      teardown(() => {
        if (element.parentNode != null) {
          element.parentNode.removeChild(element);
        }
      });

      test('hides the AR button if not on AR platform', () => {
        expect(element.canActivateAR).to.be.equal(false);
      });

      test('shows the AR button if on AR platform');
    });

    suite('ios-src', () => {
      let element: ModelViewerElementBase&ARInterface;

      setup(async () => {
        element = new ModelViewerElement();
        document.body.insertBefore(element, document.body.firstChild);

        element.ar = true;
        element.src = assetPath('models/Astronaut.glb');

        await waitForEvent(element, 'load');
      });

      teardown(() => {
        if (element.parentNode != null) {
          element.parentNode.removeChild(element);
        }
      });

      if (IS_IOS) {
        suite('on iOS Safari', () => {
          test('hides the AR button', () => {
            expect(element.canActivateAR).to.be.equal(false);
          });

          suite('with an ios-src', () => {
            setup(async () => {
              element.iosSrc = assetPath('models/Astronaut.usdz');
              await timePasses();
            });

            test('shows the AR button', () => {
              expect(element.canActivateAR).to.be.equal(true);
            });
          });
        });
      } else {
        suite('on browsers that are not iOS Safari', () => {
          test('hides the AR button', () => {
            expect(element.canActivateAR).to.be.equal(false);
          });

          suite('with an ios-src', () => {
            setup(async () => {
              element.iosSrc = assetPath('models/Astronaut.usdz');
              await timePasses();
            });

            test('still hides the AR button', () => {
              expect(element.canActivateAR).to.be.equal(false);
            });
          });
        });
      }
    });
  });
});
