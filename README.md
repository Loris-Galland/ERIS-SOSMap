# capacitor-eris-sosmap

CapacitorErisSosmap Capacitor Plugin

## Install

To use npm

```bash
npm install capacitor-eris-sosmap
````

To use yarn

```bash
yarn add capacitor-eris-sosmap
```

Sync native files

```bash
npx cap sync
```

## API

<docgen-index>

* [`triggerEmergency(...)`](#triggeremergency)
* [`startMeshNetwork()`](#startmeshnetwork)
* [`stopMeshNetwork()`](#stopmeshnetwork)
* [`broadcastMeshMessage(...)`](#broadcastmeshmessage)
* [`addListener('onMeshMessageReceived', ...)`](#addlisteneronmeshmessagereceived-)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### triggerEmergency(...)

```typescript
triggerEmergency(options: { latitude: number; longitude: number; userId: string; }) => Promise<{ transmissionMethod: string; }>
```

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code>{ latitude: number; longitude: number; userId: string; }</code> |

**Returns:** <code>Promise&lt;{ transmissionMethod: string; }&gt;</code>

--------------------


### startMeshNetwork()

```typescript
startMeshNetwork() => Promise<void>
```

--------------------


### stopMeshNetwork()

```typescript
stopMeshNetwork() => Promise<void>
```

--------------------


### broadcastMeshMessage(...)

```typescript
broadcastMeshMessage(options: { message: string; }) => Promise<void>
```

| Param         | Type                              |
| ------------- | --------------------------------- |
| **`options`** | <code>{ message: string; }</code> |

--------------------


### addListener('onMeshMessageReceived', ...)

```typescript
addListener(eventName: 'onMeshMessageReceived', listenerFunc: (event: { message: string; }) => void) => Promise<PluginListenerHandle>
```

| Param              | Type                                                  |
| ------------------ | ----------------------------------------------------- |
| **`eventName`**    | <code>'onMeshMessageReceived'</code>                  |
| **`listenerFunc`** | <code>(event: { message: string; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

--------------------


### Interfaces


#### PluginListenerHandle

| Prop         | Type                                      |
| ------------ | ----------------------------------------- |
| **`remove`** | <code>() =&gt; Promise&lt;void&gt;</code> |

</docgen-api>
