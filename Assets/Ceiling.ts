import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { AnimationManager } from "./AnimationManager";
import { PinchButton } from "SpectaclesInteractionKit/Components/UI/PinchButton/PinchButton";

const WorldQueryModule = require("LensStudio:WorldQueryModule");

@component
export class CeilingController extends BaseScriptComponent {
  @input rocket: SceneObject;
  @input animationPlayer: AnimationPlayer;
  @input launchButton: PinchButton;
  @input concreteBreakAudio: AudioComponent;

  private hitTestSession: HitTestSession;
  private isCeilingSet: boolean = false;
  private isRocketClose: boolean = false;

  onAwake() {
    this.hitTestSession = this.createHitTestSession(false);

    // Hide the object from the scene
    this.getSceneObject().getTransform().setWorldScale(vec3.zero());

    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));

    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }

  onStart() {
    const buttonSceneObject = this.launchButton.getSceneObject();
    const interactable = buttonSceneObject.getComponent(
      Interactable.getTypeName()
    );
    if (!interactable) {
      print("Error: Launch button is missing Interactable component!");
      return;
    }

    interactable.onTriggerEnd.add((event: any) => {
      this.reset();
    });
  }

  reset() {
    this.isCeilingSet = false;
    this.isRocketClose = false;
    this.getSceneObject().getTransform().setWorldScale(vec3.zero());

    this.animationPlayer.playClipAt("break", 0);
    this.animationPlayer.pauseClip("break");
  }

  createHitTestSession(filterEnabled: boolean) {
    var options = HitTestSessionOptions.create();
    options.filter = filterEnabled;

    var session = WorldQueryModule.createHitTestSessionWithOptions(options);
    return session;
  }

  onHitTestResult(results: WorldQueryHitTestResult) {
    if (results === null) {
      // Do nothing
    } else {
      const hitPosition = results.position;

      if (hitPosition.y < 30) {
        return;
      }

      this.isCeilingSet = true;

      this.getSceneObject().getTransform().setWorldPosition(hitPosition);
      // Show the object
      this.getSceneObject().getTransform().setWorldScale(vec3.one());

      print("Rocket position" + this.rocket.getTransform().getWorldPosition());
      print("Ceiling set" + hitPosition);
    }
  }

  playAnimation() {
    print("Playing animation");
    this.animationPlayer.playClipAt("break", 0);

    // Change button text to "relaunch" after 10 seconds
    var delayedEvent = this.createEvent("DelayedCallbackEvent");
    delayedEvent.bind(() => {
      this.concreteBreakAudio.play(1);
    });
    delayedEvent.reset(0.4);
  }

  onUpdate() {
    if (!AnimationManager.isAnimationStarted) {
      return;
    }

    if (this.isCeilingSet) {
      // Check if rocket it close and enable animation
      if (!this.isRocketClose) {
        const rocketPosition = this.rocket.getTransform().getWorldPosition();
        const ceilingPosition = this.getSceneObject()
          .getTransform()
          .getWorldPosition();
        const distance = rocketPosition.sub(ceilingPosition).length;

        AnimationManager.ceilingHeight = ceilingPosition.y;

        if (distance < 80) {
          this.isRocketClose = true;
          this.playAnimation();
        }
      }

      return;
    }

    const rocketPosition = this.rocket.getTransform().getWorldPosition();
    const rayStart = rocketPosition.add(vec3.up().uniformScale(50));
    const rayEnd = rocketPosition.add(vec3.up().uniformScale(1000));

    this.hitTestSession.hitTest(
      rayStart,
      rayEnd,
      this.onHitTestResult.bind(this)
    );
  }
}
