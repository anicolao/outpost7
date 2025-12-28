import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import HandApp from './HandApp.svelte'

// Simple client-side routing based on path
const pathname = window.location.pathname;

let component;

if (pathname === '/hand') {
    component = HandApp;
} else {
    component = App;
}

const app = mount(component, {
    target: document.getElementById('app')!,
})

export default app
