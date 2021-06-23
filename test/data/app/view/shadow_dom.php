<h1>Simple Shadow DOM</h1>

<script>
    customElements.define('my-app',
        class extends HTMLElement {
            constructor() {
                super();

                const template = document.getElementById('my-app');
                const templateContent = template.content;

                this.attachShadow({mode: 'open'}).appendChild(
                    templateContent.cloneNode(true)
                );
            }
        }
    );

    const slottedSpan = document.querySelector('my-app span');

</script>

<template id="my-app">
  <style>
    p {
      color: white;
      background-color: purple;
      padding: 5px;
    }
  </style>
  <p>
    <slot name="my-text">My default text</slot>
  </p>
</template>


<my-app>
  <span slot="my-text">Let's have different text!</span>
</my-app>


<my-app>
  <ul slot="my-text">
    <li>Let's have some different text!</li>
    <li>In a list!</li>
  </ul>
</my-app>