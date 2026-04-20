/**
 * Transport event types for client-server communication.
 */
export enum nojsxWSEvent {
  ComponentLoadComplete = 0x05,
  SPANavigate = 0x06,
  RPC_CALL = 0x07,
  StateSync = 0x08,
  ClientRender = 0x09,
  ClientConstruct = 0x0A,
  RPC_CALL_AWAIT = 0x0B,
  RPC_RETURN = 0x0C,

  RenderComponent_S2C = 0x24,
  StateSync_S2C = 0x25,
  UpdateHtml_S2C = 0x26,
  RPC_CALL_S2C = 0x27,
  ComponentSnapshot_S2C = 0x28,
  ComponentSnapshotSyncOnly_S2C = 0x2C,
  SPANavigate_S2C = 0x29,
  RPC_RETURN_S2C = 0x2A,
  RPC_CALL_AWAIT_S2C = 0x2B,
}
