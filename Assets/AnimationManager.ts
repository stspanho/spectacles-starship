declare const global: any;

import { PinchButton } from "./SpectaclesInteractionKit/Components/UI/PinchButton/PinchButton";
import { Interactable } from "./SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";

@component
export class AnimationManager extends BaseScriptComponent {
  @input rocketTweens: SceneObject;
  @input smokeTweens: SceneObject;
  @input armTweens: SceneObject;
  @input lookAroundInstruction: SceneObject;
  @input pinchingInstruction: SceneObject;
  @input launchAudio: AudioComponent;
  @input boosterAudio: AudioComponent;

  @input rocket: SceneObject;
  @input smoke: SceneObject;
  @input fire: SceneObject;
  @input smokeMaterial: Material;
  @input animatedRocket: SceneObject;

  @input gameScene: SceneObject;
  @input booster: SceneObject;
  @input launchButton: PinchButton;

  private isEditor = global.deviceInfoSystem.isEditor();
  private launching: boolean = false;
  private hasLaunched: boolean = false;
  private initialRocketPosition: vec3 = new vec3(0, 0, 0);

  private isReducingParticles: boolean = false;
  private particleReductionStartTime: number = 0;
  private initialInstanceCount: number = 0;
  private readonly PARTICLE_REDUCTION_DURATION: number = 10.0;

  public static isAnimationStarted: boolean = false;
  public static ceilingHeight: number = 100;
  public static isGameStarted: boolean = false;
  public static isGameOver: boolean = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.onUpdate();
    });
  }

  showCountdown(countdown: number, text: Text) {
    if (countdown > 0) {
      text.text = `Launching in ${countdown}...`;
      var delayedEvent = this.createEvent("DelayedCallbackEvent");
      delayedEvent.bind(() => {
        this.showCountdown(countdown - 1, text);
      });
      delayedEvent.reset(1.0);
    } else {
      text.text = "Launching...";
      this.startAnimation();

      // Change button text to "relaunch" after 10 seconds
      var textDelayedEvent = this.createEvent("DelayedCallbackEvent");
      textDelayedEvent.bind(() => {
        text.text = "Pinch to relaunch";
        this.launching = false;
      });
      textDelayedEvent.reset(10.0);
    }
  }

  onStart() {
    if (!this.isEditor && this.rocket) {
      //const newRotation = quat.fromEulerAngles(Math.PI / 2, 0, 0);
      //this.rocket.getTransform().setWorldRotation(newRotation);
    }

    // Store initial instance count
    this.initialInstanceCount = this.smokeMaterial.mainPass.instanceCount;

    this.smoke.getTransform().setWorldScale(vec3.zero());
    this.fire.getTransform().setWorldScale(vec3.zero());

    // Check if the button and its components are properly set up
    if (!this.launchButton) {
      print("Error: Launch button is not assigned!");
      return;
    }

    const buttonSceneObject = this.launchButton.getSceneObject();
    const interactable = buttonSceneObject.getComponent(
      Interactable.getTypeName()
    );
    if (!interactable) {
      print("Error: Launch button is missing Interactable component!");
      return;
    }

    interactable.onTriggerEnd.add((event: any) => {
      if (this.launching) {
        return;
      }

      if (this.hasLaunched) {
        this.reset();
        return;
      }

      this.launching = true;
      this.hasLaunched = true;

      // Find text component by looping through children
      const buttonSceneObject = this.launchButton.getSceneObject();
      let text: Text | null = null;

      for (let i = 0; i < buttonSceneObject.getChildrenCount(); i++) {
        const child = buttonSceneObject.getChild(i);
        const textComponent = child.getComponent("Component.Text") as Text;
        if (textComponent) {
          text = textComponent;
          break;
        }
      }

      if (text) {
        this.showCountdown(3, text);
        print("Pinch detected through code!");
      } else {
        print("Error: Could not find Text component in button children!");
      }
    });
  }

  startAnimation() {
    if (AnimationManager.isAnimationStarted) {
      return;
    }

    this.launchAudio.play(-1);

    const rocketWorldPosition = this.animatedRocket
      .getTransform()
      .getWorldPosition();
    this.initialRocketPosition = new vec3(
      rocketWorldPosition.x,
      rocketWorldPosition.y,
      rocketWorldPosition.z
    );

    this.lookAroundInstruction.enabled = false;

    AnimationManager.isAnimationStarted = true;

    // Start smoke animation
    global.tweenManager.startTween(this.smokeTweens, "smoke_launch");

    // Launch rocket
    var delayedEvent = this.createEvent("DelayedCallbackEvent");
    delayedEvent.bind(() => {
      this.fire.getTransform().setWorldScale(new vec3(0.5, 0.5, 0.5));

      if (AnimationManager.ceilingHeight > 0) {
        const newEnd = new vec3(0.0, AnimationManager.ceilingHeight + 200, 0.0);
        global.tweenManager.setEndValue(
          this.rocketTweens,
          "rocket_launch",
          newEnd
        );

        print("New end" + newEnd);
      }

      global.tweenManager.startTween(
        this.rocketTweens,
        "rocket_launch",
        this.startBooster.bind(this)
      );

      // Stop smoke animation
      global.tweenManager.stopTween(this.smokeTweens, "smoke_launch");
      global.tweenManager.startTween(this.smokeTweens, "smoke_stop");

      // Start particle reduction
      this.isReducingParticles = true;
      this.particleReductionStartTime = getTime();
    });
    delayedEvent.reset(5.0);
  }

  reset() {
    print("Resetting animation");

    this.launchAudio.stop(true);
    this.boosterAudio.stop(true);

    this.hasLaunched = false;
    AnimationManager.isAnimationStarted = false;

    this.lookAroundInstruction.enabled = true;

    global.tweenManager.stopTween(this.rocketTweens, "rocket_launch");
    global.tweenManager.stopTween(this.smokeTweens, "smoke_launch");
    global.tweenManager.stopTween(this.smokeTweens, "smoke_stop");
    global.tweenManager.stopTween(this.rocketTweens, "booster_back");
    global.tweenManager.stopTween(this.armTweens, "arm_left_close");
    global.tweenManager.stopTween(this.armTweens, "arm_right_close");

    this.rocket.enabled = true;
    this.fire.enabled = true;
    this.gameScene.enabled = false;

    this.isReducingParticles = false;
    this.particleReductionStartTime = 0;
    this.smokeMaterial.mainPass.instanceCount = this.initialInstanceCount;

    AnimationManager.isGameStarted = false;
    AnimationManager.isGameOver = false;

    this.launching = false;

    this.smoke.getTransform().setWorldScale(vec3.zero());
    this.fire.getTransform().setWorldScale(vec3.zero());

    this.pinchingInstruction.enabled = false;

    this.animatedRocket
      .getTransform()
      .setWorldPosition(this.initialRocketPosition);

    this.booster.getComponent("Physics.BodyComponent").enabled = false;

    // Reset text
    const buttonSceneObject = this.launchButton.getSceneObject();

    for (let i = 0; i < buttonSceneObject.getChildrenCount(); i++) {
      const child = buttonSceneObject.getChild(i);
      const textComponent = child.getComponent("Component.Text") as Text;
      if (textComponent) {
        textComponent.text = "Launch";
        break;
      }
    }
  }

  startBooster() {
    this.launchAudio.stop(true);
    this.boosterAudio.play(-1);
    this.rocket.enabled = false;
    this.fire.enabled = false;
    this.gameScene.enabled = true;

    const rocketWorldPosition = this.animatedRocket
      .getTransform()
      .getWorldPosition();
    const start = new vec3(
      rocketWorldPosition.x,
      rocketWorldPosition.y,
      rocketWorldPosition.z
    );
    const end = new vec3(start.x, AnimationManager.ceilingHeight, start.z);

    // Set booster rotation to match animated rocket rotation
    const rocketRotation = this.animatedRocket
      .getTransform()
      .getWorldRotation();
    this.booster.getTransform().setWorldRotation(rocketRotation);

    global.tweenManager.setStartValue(this.rocketTweens, "booster_back", start);
    global.tweenManager.setEndValue(this.rocketTweens, "booster_back", end);

    global.tweenManager.startTween(
      this.rocketTweens,
      "booster_back",
      this.startGame.bind(this)
    );

    global.tweenManager.startTween(this.armTweens, "arm_left_close");
    global.tweenManager.startTween(this.armTweens, "arm_right_close");
  }

  startGame() {
    print("Game started");

    // Enable physics body on booster
    this.booster.getComponent("Physics.BodyComponent").enabled = true;

    // Start game
    AnimationManager.isGameStarted = true;
    this.pinchingInstruction.enabled = true;
  }

  onUpdate() {
    if (this.isReducingParticles) {
      const currentTime = getTime();
      const elapsedTime = currentTime - this.particleReductionStartTime;

      if (elapsedTime >= this.PARTICLE_REDUCTION_DURATION) {
        this.smokeMaterial.mainPass.instanceCount = 1;
        this.isReducingParticles = false;
      } else {
        const progress = elapsedTime / this.PARTICLE_REDUCTION_DURATION;
        const newCount = Math.floor(this.initialInstanceCount * (1 - progress));
        this.smokeMaterial.mainPass.instanceCount = Math.max(1, newCount);
      }
    }
  }
}
