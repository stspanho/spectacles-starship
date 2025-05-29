import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { PinchButton } from "SpectaclesInteractionKit/Components/UI/PinchButton/PinchButton";

@component
export class MarkerTracking extends BaseScriptComponent {
  @input markerTrackingComponent: MarkerTrackingComponent;
  @input instruction: SceneObject;
  @input lookAroundInstruction: SceneObject;
  @input repositionButton: PinchButton;

  private recognitionCount = 0;
  private maxRecognitions = 5;
  private lastIncrementTime = 0;
  private incrementInterval = 500;

  private isEditor = global.deviceInfoSystem.isEditor();

  onAwake() {
    if (!this.isEditor) {
      this.getTransform().setWorldScale(vec3.zero());
    }

    this.createEvent("UpdateEvent").bind(() => {
      this.onUpdate();
    });

    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }

  onStart() {
    const buttonSceneObject = this.repositionButton.getSceneObject();
    const interactable = buttonSceneObject.getComponent(
      Interactable.getTypeName()
    );
    if (!interactable) {
      print("Error: Launch button is missing Interactable component!");
      return;
    }

    interactable.onTriggerEnd.add((event: any) => {
      print("Reposition button pressed");
      this.reset();
    });
  }

  reset() {
    this.getTransform().setWorldScale(vec3.zero());
    this.instruction.enabled = true;
    this.lookAroundInstruction.enabled = false;
    this.recognitionCount = 0;
    this.lastIncrementTime = 0;
  }

  onUpdate() {
    const isMarkerTracking = this.markerTrackingComponent.isTracking();
    const currentTime = Date.now();

    if (
      isMarkerTracking &&
      this.recognitionCount < this.maxRecognitions &&
      currentTime - this.lastIncrementTime >= this.incrementInterval
    ) {
      this.getTransform().setWorldScale(vec3.one());
      const markerTransform = this.markerTrackingComponent.getTransform();
      const objectTransform = this.getTransform();

      objectTransform.setWorldPosition(markerTransform.getWorldPosition());
      objectTransform.setWorldScale(markerTransform.getWorldScale());
      objectTransform.setWorldRotation(markerTransform.getWorldRotation());

      if (!this.isEditor) {
        // Position on tower move on x axis
        //const worldPosition = this.getTransform().getWorldPosition();
        //const newPosition = new vec3(
        //worldPosition.x - 9,
        //worldPosition.y + 10,
        //worldPosition.z + 11.5
        //);
        //this.getTransform().setWorldPosition(newPosition);
      }

      // Apply an additional 90-degree rotation around the X axis
      const extraRotation = quat.fromEulerAngles(Math.PI / 2, 0, 0); // 90 degrees in radians
      objectTransform.setLocalRotation(
        objectTransform.getLocalRotation().multiply(extraRotation)
      );

      print("Image is in Camera feed. Transform copied.");

      this.recognitionCount++;
      this.lastIncrementTime = currentTime;

      this.instruction.enabled = false;
      this.lookAroundInstruction.enabled = true;
    } else if (!isMarkerTracking) {
      // print("Image is NOT in Camera feed.");
    } else if (this.recognitionCount >= this.maxRecognitions) {
      // print("Max recognitions reached. Stopping transform updates.");
    }
  }
}
