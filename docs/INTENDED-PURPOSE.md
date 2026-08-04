<!-- doc-version: 2026-07-31-v8 -->

# Intended Purpose

**T1D Simulator is an educational game for exploring factors that affect blood glucose in type 1 diabetes through fixed fictional characters. It is not intended to diagnose, monitor, predict, recommend, or inform treatment for any individual.**

---

## What this tool is

T1D Simulator lets a player explore how blood glucose behaves in type 1 diabetes by helping fixed fictional characters and watching what happens. The learning is about the *phenomena and mechanisms* of glucose regulation:

- what insulin does, and the difference between basal (background) and bolus (mealtime) insulin;
- how food, exercise, and stress disturb blood glucose, and over what timescale;
- what hypoglycaemia, hyperglycaemia, and diabetic ketoacidosis (DKA) are, why they matter, and what conditions lead toward them.

The player learns by doing. They give insulin, food, and exercise to a fixed, fictional character and observe the resulting glucose dynamics. The available game actions use deliberately coarse controls. The model's exact internal basal requirement is not displayed.

The characters are **fixed archetypes**. The player chooses a character to help (for example by body size); the character's underlying physiological parameters are predefined and are not shown as clinical values. The point of the game is to understand the behaviour of the system, demonstrated on these characters. The interface therefore describes the character in the third person and uses “you” only for the player's controls, choices, observations, and score.

### Public application and model source

This intended purpose describes the **public web application**. Its normal start paths accept a fixed `characterId`, resolve the corresponding predefined model subject, and do not expose controls for entering weight, ISF, ICR, CGM data, or other personal treatment data.

The open-source repository also documents a general-purpose physiology engine. The engine accepts explicit model parameters so developers can reproduce tests, calibrate mechanisms, and construct hypothetical model subjects. The public application does not expose those parameters as user controls. Unrestricted developer controls are not part of the public runtime interface. A third party that modifies or republishes the software for a different purpose must assess that separate implementation and its claims.

### Public What If view

What If is a restricted learning view opened from an active Campaign or Box Challenge session. It keeps the already selected fixed character and the actions already played. The player may change game actions only within the played period and compare the resulting simulated course for up to six hours beyond that point.

The view accepts no personal parameters or health data, has no public import or export function, does not identify a preferred alternative, and does not transfer changes back to the paused game. Returning to the game therefore continues the original session unchanged.

## What this tool deliberately is not

This tool is built around understanding, and several things follow from that purpose by design:

- **It returns no insulin dose for a real person.** The public game displays insulin amounts only as actions applied to fixed fictional characters.
- **The public interface does not support self-modelling.** There is no public entry of one's own insulin sensitivity factor (ISF), insulin-to-carbohydrate ratio (ICR), weight, CGM history, or other personal treatment data. Manipulated raw values in public localStorage or start-function arguments are discarded and the selected fixed character is resolved again before the game engine starts.
- **Dosing the in-game character is a game action, not personal dose advice.** Choosing how much insulin to give the character is part of playing. The available controls are attached to the selected character and no value is calculated from the player's data or transferred to any real person.

These are properties of what the public tool is *for* and how its runtime paths behave. The distinction between a fictional scenario parameter and an individual treatment recommendation is deliberate: the public application lets the player act on predefined model subjects, not model a real person.

## Why understanding, not dosing

The choice to teach physiology rather than to produce a dose is both an educational and a safety position, and the two reinforce each other.

A simulator runs on a population model supported by published literature. It represents hypothetical model subjects, not a specific person, and insulin sensitivity varies substantially between individuals and from day to day. A number that keeps the in-game character stable is the character's number, not the player's.

Teaching the phenomena avoids individual dose calculation. The player learns the *direction and mechanism* — too little basal and glucose drifts up, too much and it falls; carbohydrate raises glucose quickly; exercise lowers it and can cause delayed lows. Concrete insulin amounts remain inputs to a fictional game scenario. The exact internal basal result is not shown, and no value is derived from personal data. The model's stochastic response further prevents a single exact value from becoming the lesson.

Insulin dosing decisions belong with the user's own clinical care team, based on the user's own data. This tool is designed to help a person *understand* their condition so they can engage with that care more confidently — not to substitute for it.

## Scope and intended users

T1D Simulator is intended for people who want to understand type 1 diabetes glucose physiology: newly diagnosed patients, children and their families, and anyone learning how insulin, food, exercise, and stress interact in the body. It is a learning and exploration tool used on fixed fictional characters in a simulated environment.

It is **not** intended for:

- determining, recommending, or adjusting any individual's insulin dose;
- diagnosing, monitoring, treating, or managing the condition of a specific person;
- any clinical decision-making, in place of or alongside a healthcare professional.

## Regulatory position

**The public tool is designed and described as an educational game, not as software with a medical intended purpose. It does not provide insulin doses or treatment recommendations for real people and is not intended to replace clinical care.**

---

*This document is the project's stated intended purpose. It is an interpretation of EU MDR 2017/745 and the qualification guidance in MDCG 2019-11 — not legal advice and not a regulatory determination. Final qualification of a product as a medical device rests with the competent authority or a court.*
