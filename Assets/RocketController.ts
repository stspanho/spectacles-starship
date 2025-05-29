declare const global: any;

import { SIK } from "SpectaclesInteractionKit/SIK";
import { AnimationManager } from "./AnimationManager";
import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { PinchButton } from "SpectaclesInteractionKit/Components/UI/PinchButton/PinchButton";

@component
export class RocketController extends BaseScriptComponent {
  @input boosterFire: SceneObject;
  @input handle1: SceneObject;
  @input handle2: SceneObject;
  @input rocketTweens: SceneObject;
  @input explosionAnimation: Material;
  @input explosionObject: SceneObject;
  @input launchButton: PinchButton;
  @input rightArm: SceneObject;
  @input leftArm: SceneObject;
  @input pinchingInstruction: SceneObject;
  @input boosterAudio: AudioComponent;
  @input explosionAudio: AudioComponent;

  private pinchStartPos: vec3 = null;
  private currentPinchPos: vec3 = null;
  private initialPosition: vec3 = null;

  private readonly movementScale: number = 2.0;
  private readonly forceMultiplier: number = 3.0;
  private readonly baseUpwardForce: number = 15.0;
  private readonly rotationFactor: number = 4.0;

  // Track which arms we've collided with at low speed
  private leftArmContact: boolean = false;
  private rightArmContact: boolean = false;
  private readonly maxDockingSpeed: number = 15.0; // Maximum speed for successful docking
  private readonly explosionSpeed: number = 15.0;

  private isExploded: boolean = false;

  onAwake() {
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

    // Set up general collision detection for the rocket
    const rocketCollider = this.getSceneObject().getComponent(
      "ColliderComponent"
    ) as ColliderComponent;
    if (rocketCollider) {
      rocketCollider.onCollisionEnter.add((event) => {
        if (this.isExploded) {
          return;
        }

        const body = this.getSceneObject().getComponent(
          "Physics.BodyComponent"
        );
        const velocity = body.velocity;
        const speed = velocity.length;

        // Log general collisions
        const collidingObjectName =
          event.collision.collider.getSceneObject().name;
        print(
          "Rocket collision with: " +
            collidingObjectName +
            " (speed: " +
            speed.toFixed(2) +
            ")"
        );

        if (speed > this.explosionSpeed) {
          this.boosterAudio.stop(true);
          this.explosionAudio.play(1);

          // Hard collision threshold - explosion
          print("EXPLODE!");
          AnimationManager.isGameOver = true;
          body.dynamic = false;
          // Reset contacts on explosion
          this.leftArmContact = false;
          this.rightArmContact = false;

          this.isExploded = true;

          this.boosterFire.enabled = false;

          const provider = this.explosionAnimation.mainPass.baseTex;
          if (
            provider &&
            provider.control &&
            provider.control.isOfType("Provider.AnimatedTextureFileProvider")
          ) {
            this.explosionObject.enabled = true;
            print("Playing explosion animation");
            (provider.control as any).play(1, 0);
          }
          const sceneObject = this.getSceneObject();
          for (let i = 0; i < sceneObject.getChildrenCount(); i++) {
            const child = sceneObject.getChild(i);
            if (child.name === "Scenes" || child.name === "Fire") {
              child.enabled = false;
            }
          }

          return;
        }

        // Check for docking conditions
        if (speed <= this.maxDockingSpeed) {
          // Check if handle1 or handle2 is close to the arms.
          const handle1pos = this.handle1.getTransform().getWorldPosition();
          const handle2pos = this.handle2.getTransform().getWorldPosition();
          const collidingObject = event.collision.collider.getSceneObject();
          const armPos = collidingObject.getTransform().getWorldPosition();

          print("handle1pos.y: " + handle1pos.y);
          print("handle2pos.y: " + handle2pos.y);
          print("armPos.y: " + armPos.y);
          if (handle1pos.y - 0.5 < armPos.y || handle2pos.y - 0.5 < armPos.y) {
            print("Checking arm contact");
            print("collidingObjectName: " + collidingObjectName);

            if (collidingObjectName === "Catch_Arm_Left") {
              this.leftArmContact = true;
              print("Left arm contact established");
            } else if (collidingObjectName === "Catch_Arm_Right") {
              this.rightArmContact = true;
              print("Right arm contact established");
            }

            // Check if we've contacted both arms
            if (this.leftArmContact && this.rightArmContact) {
              print("Success! Rocket docked with both arms");
              AnimationManager.isGameOver = true;
              body.dynamic = false;
              this.boosterFire.enabled = false;
              this.boosterAudio.stop(true);
            }
          }
        } else {
          // Reset contacts if speed is too high
          if (collidingObjectName === "Catch_Arm_Left") {
            this.leftArmContact = false;
          } else if (collidingObjectName === "Catch_Arm_Right") {
            this.rightArmContact = false;
          }
        }
      });
    }

    this.createEvent("OnStartEvent").bind(() => {
      // Set initial physics properties for smooth rotation
      const body = this.getSceneObject().getComponent("Physics.BodyComponent");
      body.angularDamping = 0.8; // Increased damping for better stability
      this.initialPosition = this.getSceneObject()
        .getTransform()
        .getWorldPosition();
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.onUpdate();
    });

    // Add hand tracking event handlers
    const handInputData = SIK.HandInputData;
    const leftHand = handInputData.getHand("left");

    leftHand.onPinchDown.add(() => {
      if (!AnimationManager.isGameStarted) {
        return;
      }

      this.pinchingInstruction.enabled = false;

      const indexTip = leftHand.indexTip;
      if (indexTip) {
        this.pinchStartPos = indexTip.position;
      }
    });

    leftHand.onPinchUp.add(() => {
      if (!AnimationManager.isGameStarted) {
        return;
      }

      this.pinchStartPos = null;
      this.currentPinchPos = null;
    });
  }

  onUpdate() {
    if (!AnimationManager.isGameStarted) {
      return;
    }

    if (AnimationManager.isGameOver) {
      return;
    }

    // Get the physics body
    const body = this.getSceneObject().getComponent("Physics.BodyComponent");

    // Zero out any y-axis angular velocity to prevent yaw rotation
    const angularVel = body.angularVelocity;
    body.angularVelocity = new vec3(angularVel.x, 0, angularVel.z);

    if (this.pinchStartPos) {
      const handInputData = SIK.HandInputData;
      const leftHand = handInputData.getHand("left");

      if (leftHand.isPinching()) {
        const indexTip = leftHand.indexTip;
        if (indexTip) {
          this.currentPinchPos = indexTip.position;

          // Calculate deltas for horizontal movement only
          const deltaX =
            (this.currentPinchPos.x - this.pinchStartPos.x) /
            this.movementScale;
          const deltaZ =
            (this.currentPinchPos.z - this.pinchStartPos.z) /
            this.movementScale;

          // Apply horizontal movement forces and constant upward force
          const force = new vec3(
            deltaX * this.forceMultiplier,
            this.baseUpwardForce,
            deltaZ * this.forceMultiplier
          );

          // Calculate rotation based on movement direction (inverted)
          const torque = new vec3(
            deltaZ * this.rotationFactor, // Inverted pitch (tilt forward/back)
            0, // No yaw rotation
            -deltaX * this.rotationFactor // Inverted roll (tilt left/right)
          );

          // Apply forces and rotation
          body.addForce(force, Physics.ForceMode.Force);
          body.addTorque(torque, Physics.ForceMode.Impulse);
        }
      }
    }
  }

  reset() {
    this.isExploded = false;
    this.leftArmContact = false;
    this.rightArmContact = false;
    this.boosterFire.enabled = true;
    this.pinchStartPos = null;
    this.currentPinchPos = null;

    const sceneObject = this.getSceneObject();
    for (let i = 0; i < sceneObject.getChildrenCount(); i++) {
      const child = sceneObject.getChild(i);
      if (child.name === "Scenes" || child.name === "Fire") {
        child.enabled = true;
      }
    }

    const body = this.getSceneObject().getComponent("Physics.BodyComponent");
    body.dynamic = true;
    body.velocity = vec3.zero();
    body.angularVelocity = vec3.zero();
    body.enabled = false;

    this.getSceneObject().getTransform().setWorldPosition(this.initialPosition);

    // Set arm rotations
    this.rightArm
      .getTransform()
      .setLocalRotation(quat.fromEulerAngles(0, (30 * Math.PI) / 180, 0));
    this.leftArm
      .getTransform()
      .setLocalRotation(quat.fromEulerAngles(0, (-30 * Math.PI) / 180, 0));

    body.enabled = true;
  }
}
