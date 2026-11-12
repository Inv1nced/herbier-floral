import gsap from "gsap";

const vertex = `
attribute vec2 point;
varying vec2 uv;
void main() {
  uv = point * .5 + .5;
  gl_Position = vec4(point, 0., 1.);
}`;

const fragment = `
precision mediump float;
varying vec2 uv;
uniform sampler2D previousImage, nextImage;
uniform vec2 previousSize, nextSize;
uniform float progress, direction;

vec4 sampleImage(sampler2D image, vec2 size, vec2 point) {
  vec2 pos = (point - .5) / size + .5;
  if (min(pos.x, pos.y) < 0. || max(pos.x, pos.y) > 1.) return vec4(0.);
  return texture2D(image, pos);
}

void main() {
  float wave = sin(uv.y * 15. + uv.x * 6. + progress * 7.)
             + .42 * cos(uv.y * 39. - uv.x * 9.);
  float edge = (uv.x - .5) * direction + .09 * wave;
  float blend = smoothstep(-.17, .17, (progress - .5) * 1.7 + edge);
  vec2 shift = vec2(direction, wave * .34) * sin(progress * 3.14159) * .085;
  vec4 a = sampleImage(previousImage, previousSize, uv + shift * (blend + .25));
  vec4 b = sampleImage(nextImage, nextSize, uv - shift * (1.25 - blend));
  gl_FragColor = mix(a, b, blend);
}`;

export function createDisplacement(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const points = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, points);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const attribute = gl.getAttribLocation(program, "point");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  const location = (name) => gl.getUniformLocation(program, name);
  const progressUniform = location("progress");
  const directionUniform = location("direction");
  const textures = ["previous", "next"].map((name, index) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const axis of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) {
      gl.texParameteri(gl.TEXTURE_2D, axis, gl.CLAMP_TO_EDGE);
    }
    for (const filter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) {
      gl.texParameteri(gl.TEXTURE_2D, filter, gl.LINEAR);
    }
    gl.uniform1i(location(name + "Image"), index);
    return { texture, size: location(name + "Size") };
  });

  return (before, after, direction) => {
    if (gl.isContextLost() || !before.naturalWidth || !after.naturalWidth)
      return null;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return null;
    const density = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    gl.viewport(0, 0, canvas.width, canvas.height);
    [before, after].forEach((image, index) => {
      const { texture, size } = textures[index];
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      const scale = Math.min(
        (width * 0.9) / image.naturalWidth,
        (height - width * 0.1) / image.naturalHeight,
      );
      gl.uniform2f(
        size,
        (scale * image.naturalWidth) / width,
        (scale * image.naturalHeight) / height,
      );
    });
    gl.uniform1f(directionUniform, direction);
    const state = { value: 0 };
    const draw = () => {
      gl.uniform1f(progressUniform, state.value);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    draw();
    canvas.classList.add("active");
    return new Promise((resolve) => {
      gsap.to(state, {
        value: 1,
        duration: 0.9,
        ease: "power2.inOut",
        onUpdate: draw,
        onComplete: () => {
          canvas.classList.remove("active");
          resolve();
        },
      });
    });
  };
}
