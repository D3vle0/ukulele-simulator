let pressed4 = new Array();
let pressed3 = new Array();
let pressed2 = new Array();
let pressed1 = new Array();
let string4 = ["z", "x", "c", "v"];
let string3 = ["a", "s", "d", "f", "g"];
let string2 = ["q", "w", "e", "r", "t"];
let string1 = ["1", "2", "3", "4", "5", "6", "7", "8"];
let tune4_low = ["low_Gs", "low_A", "low_As", "low_B"]; // same length as string4
let tune4 = ["Gs", "A", "As", "B"]; // same length as string4
let tune3 = ["Cs", "D", "Ds", "E", "F"]; // same length as string3
let tune2 = ["F", "Fs", "G", "Gs", "A"]; // same length as string2
let tune1 = ["As", "B", "high_C", "high_Cs", "high_D", "high_Ds", "high_E", "high_F"]; // same length as string1
let single4 = ["m", ",", "."];
let single3 = ["k", "l", ";"];
let single2 = ["o", "p", "["];
let single1 = ["0", "-", "="];

window.addEventListener("keydown", e => {
    if (e.key !== " ") {
        if (string4.includes(e.key))
            pressed4.push(e.key);
        else if (string3.includes(e.key))
            pressed3.push(e.key);
        else if (string2.includes(e.key))
            pressed2.push(e.key);
        else if (string1.includes(e.key))
            pressed1.push(e.key);
    }
    else if (e.key === " ") {
        let sound4 = tune4[string4.indexOf(pressed4[0])] || "G";
        let sound3 = tune3[string3.indexOf(pressed3[0])] || "C";
        let sound2 = tune2[string2.indexOf(pressed2[0])] || "E";
        let sound1 = tune1[string1.indexOf(pressed1[0])] || "A";
        console.log(sound4, sound3, sound2, sound1);
        new Audio(`./sounds/${sound4}.wav`).play()
        new Audio(`./sounds/${sound3}.wav`).play()
        new Audio(`./sounds/${sound2}.wav`).play()
        new Audio(`./sounds/${sound1}.wav`).play()
    }
    if (single4.includes(e.key)) {
        let sound4 = tune4[string4.indexOf(pressed4[0])] || "G";
        new Audio(`./sounds/${sound4}.wav`).play()
    }
    if (single3.includes(e.key)) {
        let sound3 = tune3[string3.indexOf(pressed3[0])] || "C";
        new Audio(`./sounds/${sound3}.wav`).play()
    }
    if (single2.includes(e.key)) {
        let sound2 = tune2[string2.indexOf(pressed2[0])] || "E";
        new Audio(`./sounds/${sound2}.wav`).play()
    }
    if (single1.includes(e.key)) {
        let sound1 = tune1[string1.indexOf(pressed1[0])] || "A";
        new Audio(`./sounds/${sound1}.wav`).play()
    }
    console.log(pressed4, pressed3, pressed2, pressed1);
});

window.addEventListener("keyup", e => {
    pressed4 = pressed4.filter(key => key !== e.key);
    pressed3 = pressed3.filter(key => key !== e.key);
    pressed2 = pressed2.filter(key => key !== e.key);
    pressed1 = pressed1.filter(key => key !== e.key);
});