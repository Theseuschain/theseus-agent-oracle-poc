//! # Tool Override Pallet (demo only)
//!
//! Lets a privileged origin install a fake reading for a specific agent's
//! specific tool, valid for N future runs of that agent. The tool-executor
//! checks this storage before dispatching the real tool. After the configured
//! number of runs, the override expires and the real tool returns.
//!
//! **This pallet exists only for the price-oracle PoC's demo flow.** In
//! production, agents resolve tools through the standard tool-executor and
//! there is no override path. Build behind a feature flag and do not ship to
//! mainnet.
//!
//! ## Storage
//! - `Overrides: Map<(AgentId, ToolName), OverrideEntry>`
//! - `RunCounter: Map<AgentId, u32>` — incremented by the tool-executor on
//!   each agent run; the pallet uses this to expire overrides.
//!
//! ## Extrinsics
//! - `override_tool(agent, tool, override_value, runs_remaining)` — install
//! - `clear_overrides(agent)` — wipe all overrides for an agent
//! - `tick(agent)` — called by the tool-executor on each run; decrements
//!   `runs_remaining` and removes expired entries
//!
//! ## Hook the tool-executor uses
//! `Overrides::resolve(agent, tool) -> Option<Vec<u8>>` returns the SCALE-
//! encoded override return value, or None if no override exists. The tool-
//! executor injects this between tool resolution and tool dispatch.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use parity_scale_codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_std::vec::Vec;

#[derive(Clone, Encode, Decode, MaxEncodedLen, TypeInfo, Debug, PartialEq, Eq)]
#[scale_info(skip_type_params(MaxValueLen))]
pub struct OverrideEntry<MaxValueLen: Get<u32>> {
    /// Pre-encoded return value (SCALE-encoded bytes that match the tool's
    /// declared return type). The tool-executor returns this verbatim.
    pub value: BoundedVec<u8, MaxValueLen>,
    /// How many more agent runs the override is active for. Decremented to
    /// zero, then removed.
    pub runs_remaining: u32,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    /// Maximum length of a SCALE-encoded override value. 4KB is plenty —
    /// `VenueReading` encodes to under 200 bytes.
    pub const MAX_VALUE_LEN: u32 = 4096;
    /// Maximum tool-name length.
    pub const MAX_TOOL_NAME_LEN: u32 = 64;

    pub type ToolName = BoundedVec<u8, ConstU32<MAX_TOOL_NAME_LEN>>;
    pub type Entry = OverrideEntry<ConstU32<MAX_VALUE_LEN>>;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// SECURITY: must be a privileged origin (e.g. `EnsureRoot` or a
        /// sudo-equivalent). Wiring this to `EnsureSigned<T::AccountId>` would
        /// let any signed account install overrides and is a misconfiguration.
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Origin the tool-executor uses to call `tick`. Should be a
        /// runtime-internal origin proving the call is on behalf of `agent`,
        /// not user-callable. The returned `AccountId` must equal the `agent`
        /// argument or `tick` errors with `TickOriginMismatch`.
        type TickOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Self::AccountId>;
    }

    #[pallet::storage]
    pub type Overrides<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, T::AccountId, Blake2_128Concat, ToolName, Entry>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        Overridden { agent: T::AccountId, tool: ToolName, runs_remaining: u32 },
        Cleared   { agent: T::AccountId, tool: ToolName },
        ClearedAll { agent: T::AccountId },
        Expired   { agent: T::AccountId, tool: ToolName },
    }

    #[pallet::error]
    pub enum Error<T> {
        ValueTooLong,
        ToolNameTooLong,
        ZeroRuns,
        /// `tick` was called by an origin that doesn't match the agent it
        /// claims to be acting for.
        TickOriginMismatch,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Install an override for `agent`'s `tool`. The next `runs_remaining`
        /// scheduled runs of the agent will see `value` instead of the real
        /// tool result.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn override_tool(
            origin: OriginFor<T>,
            agent: T::AccountId,
            tool: Vec<u8>,
            value: Vec<u8>,
            runs_remaining: u32,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(runs_remaining > 0, Error::<T>::ZeroRuns);

            let tool_name: ToolName =
                tool.try_into().map_err(|_| Error::<T>::ToolNameTooLong)?;
            let bounded_value: BoundedVec<u8, ConstU32<MAX_VALUE_LEN>> =
                value.try_into().map_err(|_| Error::<T>::ValueTooLong)?;

            Overrides::<T>::insert(
                &agent,
                &tool_name,
                OverrideEntry { value: bounded_value, runs_remaining },
            );

            Self::deposit_event(Event::Overridden {
                agent,
                tool: tool_name,
                runs_remaining,
            });
            Ok(())
        }

        /// Clear a single override.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn clear_override(
            origin: OriginFor<T>,
            agent: T::AccountId,
            tool: Vec<u8>,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            let tool_name: ToolName =
                tool.try_into().map_err(|_| Error::<T>::ToolNameTooLong)?;
            Overrides::<T>::remove(&agent, &tool_name);
            Self::deposit_event(Event::Cleared { agent, tool: tool_name });
            Ok(())
        }

        /// Clear every override for an agent. Used by `op reset`.
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn clear_overrides(origin: OriginFor<T>, agent: T::AccountId) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            let _ = Overrides::<T>::clear_prefix(&agent, u32::MAX, None);
            Self::deposit_event(Event::ClearedAll { agent });
            Ok(())
        }

        /// Called by the tool-executor at the start of each scheduled agent
        /// run. Decrements every override's run counter and removes those
        /// that hit zero.
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(20_000, 0))]
        pub fn tick(origin: OriginFor<T>, agent: T::AccountId) -> DispatchResult {
            // The tool-executor's origin proves it's running on behalf of `agent`.
            let signer = T::TickOrigin::ensure_origin(origin)?;
            ensure!(signer == agent, Error::<T>::TickOriginMismatch);

            // Two-pass: collect everything, then mutate. Inserting back into
            // the same key being iterated is undefined for some hashers.
            let entries: sp_std::vec::Vec<_> = Overrides::<T>::iter_prefix(&agent).collect();
            let mut expired = sp_std::vec![];

            for (tool, entry) in entries {
                if entry.runs_remaining <= 1 {
                    expired.push(tool);
                } else {
                    Overrides::<T>::insert(
                        &agent,
                        &tool,
                        OverrideEntry { value: entry.value, runs_remaining: entry.runs_remaining - 1 },
                    );
                }
            }

            for tool in expired {
                Overrides::<T>::remove(&agent, &tool);
                Self::deposit_event(Event::Expired { agent: agent.clone(), tool });
            }
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Resolve an active override for (agent, tool). Called by the tool-
        /// executor *before* dispatching the real tool. Returns the encoded
        /// override return value, or None if no override is in effect.
        ///
        /// Does not consume the override — `tick` is the consumer.
        pub fn resolve(agent: &T::AccountId, tool: &[u8]) -> Option<Vec<u8>> {
            let tool_name: ToolName = tool.to_vec().try_into().ok()?;
            Overrides::<T>::get(agent, &tool_name).map(|e| e.value.into_inner())
        }
    }
}
