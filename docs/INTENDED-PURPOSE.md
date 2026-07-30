<!-- doc-version: 2026-07-30-v7 -->

# Intended Purpose

**T1D Simulator is an educational game for exploring factors that affect blood glucose in type 1 diabetes through fixed fictional characters. It is not intended to diagnose, monitor, predict, recommend, or inform treatment for any individual.**

---

## What this tool is

T1D Simulator lets a player explore how blood glucose behaves in type 1 diabetes by helping fixed fictional characters and watching what happens. The learning is about the *phenomena and mechanisms* of glucose regulation:

- what insulin does, and the difference between basal (background) and bolus (mealtime) insulin;
- how food, exercise, and stress disturb blood glucose, and over what timescale;
- what hypoglycaemia, hyperglycaemia, and diabetic ketoacidosis (DKA) are, why they matter, and what conditions lead toward them.

The player learns by doing. They give insulin, food, and exercise to a fixed, fictional character and observe the resulting glucose dynamics. A curated introduction may show a deliberately coarse range to try on the named character, so the player is not forced to guess blindly. The range is a game parameter for that fictional scenario, not an output calculated for the player.

The characters are **fixed archetypes**. The player chooses a character to help (for example by body size); the character's underlying physiological parameters are predefined and are not shown as clinical values. The point of the game is to understand the behaviour of the system, demonstrated on these characters. The interface therefore describes the character in the third person and uses “you” only for the player's controls, choices, observations, and score.

### Public application and model source

This intended purpose describes the **public web application**. Its normal start paths accept a fixed `characterId`, resolve the corresponding predefined model subject, and do not expose controls for entering weight, ISF, ICR, CGM data, or other personal treatment data.

The open-source repository also documents a general-purpose physiology engine. The engine accepts explicit model parameters so developers can reproduce tests, calibrate mechanisms, and construct hypothetical model subjects. The public application does not expose those parameters as user controls. Unrestricted scenario-authoring tools are maintained separately and are not distributed or loaded by the public application. A third party that modifies or republishes the software for a different purpose must assess that separate implementation and its claims.

## What this tool deliberately is not

This tool is built around understanding, and several things follow from that purpose by design:

- **It returns no insulin dose for a real person.** The public game displays insulin amounts only as actions applied to fixed fictional characters.
- **The public interface does not support self-modelling.** There is no public entry of one's own insulin sensitivity factor (ISF), insulin-to-carbohydrate ratio (ICR), weight, CGM history, or other personal treatment data. Manipulated raw values in public localStorage or start-function arguments are discarded and the selected fixed character is resolved again before the game engine starts.
- **Dosing the in-game character is a game action, not personal dose advice.** Choosing how much insulin to give the character is part of playing. Any displayed trial range is deliberately coarse and attached to the character by name; it is not calculated from the player's data and does not transfer to any real person.

These are properties of what the public tool is *for* and how its runtime paths behave. The distinction between a fictional scenario parameter and an individual treatment recommendation is deliberate: the public application lets the player act on predefined model subjects, not model a real person.

## Why understanding, not dosing

The choice to teach physiology rather than to produce a dose is both an educational and a safety position, and the two reinforce each other.

A simulator runs on a population model. Even a well-validated model describes a typical body, not a specific person — and in type 1 diabetes, insulin sensitivity varies substantially between individuals and even day to day in the same individual. A number that keeps the in-game character stable is the character's number, not the player's. Insulin has a narrow therapeutic window in which errors cause harm within hours, so a personal dose is precisely the thing that must come from the user's own data and their own clinical care team — not from a game.

Teaching the phenomena avoids individual dose calculation. The player learns the *direction and mechanism* — too little basal and glucose drifts up, too much and it falls; carbohydrate raises glucose quickly; exercise lowers it and can cause delayed lows. Concrete insulin amounts remain inputs to a fictional game scenario. The exact internal basal result is not shown, the displayed starting range is coarse, and no value is derived from personal data. The model's stochastic response further prevents a single exact value from becoming the lesson.

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
