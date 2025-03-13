declare const global: any;

import { SIK } from "SpectaclesInteractionKit/SIK";

@component
export class MarkerTracking extends BaseScriptComponent {
  @input markerTrackingComponent: MarkerTrackingComponent;
  @input rocket: SceneObject;
  @input objectWithTweens: SceneObject;

  private recognitionCount = 0;
  private maxRecognitions = 5;
  private isEditor = global.deviceInfoSystem.isEditor();

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.onUpdate();
    });
  }

  onStart() {
    if (!this.isEditor && this.rocket) {
      //const newRotation = quat.fromEulerAngles(Math.PI / 2, 0, 0);
      //this.rocket.getTransform().setWorldRotation(newRotation);
    }

    const handInputData = SIK.HandInputData;
    const leftHand = handInputData.getHand("left");

    leftHand.onPinchDown(() => {
      this.launchRocket();
    });
  }

  onUpdate() {
    const isMarkerTracking = this.markerTrackingComponent.isTracking();

    if (isMarkerTracking && this.recognitionCount < this.maxRecognitions) {
      const markerTransform = this.markerTrackingComponent.getTransform();

      const objectTransform = this.getTransform();

      objectTransform.setWorldPosition(markerTransform.getWorldPosition());
      objectTransform.setWorldScale(markerTransform.getWorldScale());
      objectTransform.setWorldRotation(markerTransform.getWorldRotation());

      // Apply an additional 90-degree rotation around the Y axis
      const extraRotation = quat.fromEulerAngles(Math.PI / 2,0, 0); // 90 degrees in radians
      objectTransform.setLocalRotation(
        objectTransform.getLocalRotation().multiply(extraRotation)
      );

      print("Image is in Camera feed. Transform copied.");

      this.recognitionCount++;
    } else if (!isMarkerTracking) {
      // print("Image is NOT in Camera feed.");
    } else if (this.recognitionCount >= this.maxRecognitions) {
      // print("Max recognitions reached. Stopping transform updates.");
    }
  }

  launchRocket() {
    global.tweenManager.startTween(this.objectWithTweens, "rocket_launch");
  }
}
