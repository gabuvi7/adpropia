# AdPropIA Pricing Strategy

This document records the internal pricing baseline for the assisted plan recommender and request-access flow. Prices are public-facing candidates, but the activation remains assisted: the form recommends a plan and sends the request for manual review before provisioning Auth0 Organizations, tenants, and users.

## Decision

Use public prices, but keep onboarding assisted.

| Plan | Target customer | Suggested limits | Public monthly price |
|------|-----------------|------------------|----------------------|
| Inicial | Small administration starting to professionalize operations | Up to 50 units, 2 users | ARS 49,000 |
| Profesional | Growing real-estate team with recurring indexed contracts | Up to 200 units, 5 users | ARS 119,000 |
| Operativo | Larger operation with more users, liquidations, audit needs, and automation | Up to 500 units, 10 users | ARS 229,000 |
| A medida | Larger or special operations | Custom limits | Contact sales |

The recommender should use these thresholds:

| Inputs | Recommended plan |
|--------|------------------|
| `units <= 50` and `users <= 2` | Inicial |
| `units <= 200` and `users <= 5` | Profesional |
| `units <= 500` and `users <= 10` | Operativo |
| Anything above those limits | A medida |

This pricing intentionally positions AdPropIA as:

- more expensive than lightweight rental-only tools like Barreeo,
- materially cheaper than Tokko for comparable user/property bands,
- focused on rental administration depth: indexes, cash management, liquidations, auditability, and tenant-scoped operations.

## Positioning

AdPropIA should not compete as the cheapest rental tool. The value proposition is professional, multi-client operation management:

- indexed rent adjustments with IPC, ICL, UVA, fixed, manual, or custom rules,
- reviewable automation for upcoming updates and effective dates,
- cash management for collections, payments, cash movements, balances, and liquidation support,
- audit trails and decision traceability,
- owners, renters, contracts, payments, liquidations, and index data under one tenant-scoped operation,
- assisted onboarding instead of unmanaged self-service provisioning.

## Local and regional benchmark notes

### Tokko Broker Argentina benchmark

Tokko is useful because it prices by both property count and user count, which matches the planned AdPropIA recommender axes.

| Tokko plan | Properties | Users | Public monthly price | Price before national taxes |
|------------|------------|-------|----------------------|-----------------------------|
| Personal | 15 | 1 | ARS 67,742 | ARS 55,985 |
| Inicial | 40 | 2 | ARS 132,967 | ARS 109,890 |
| Equipo | 90 | 4 | ARS 230,908 | ARS 190,833 |
| Profesional | 200 | 10 | ARS 367,185 | ARS 303,459 |
| Corporativo | 300 | 15 | ARS 637,551 | ARS 526,902 |

Compared with this benchmark, AdPropIA's proposed public prices are intentionally lower than Tokko for similar or larger operational thresholds, while still positioned above low-cost rental-only tools.

### 2clics Argentina benchmark

2clics is useful because it is a direct Argentine CRM benchmark for real-estate agencies. Its pricing is not primarily rental-administration pricing; it emphasizes website, property diffusion, lead management, sales funnel, communications, and CRM automation.

| 2clics plan | Included users / email accounts | Public monthly price | Annual-payment equivalent shown | Main positioning |
|-------------|----------------------------------|----------------------|---------------------------------|------------------|
| Esencial | 2 users / 5 email accounts | ARS 57,118 | ARS 47,408.11/month equivalent | Website, property administration, property diffusion, ChatGPT descriptions, real-estate network, support. |
| Avanzado | 4 users / 7 email accounts | ARS 95,603 | ARS 79,350.49/month equivalent | Sales funnel, centralized inquiries, private real-estate networks, property landing pages, reports, developments, blog, professional appraisals. |
| Profesional | 6 users / 9 email accounts | ARS 163,911 | ARS 136,046.13/month equivalent | Automatic replies, Google Calendar, email integration, activities panel, branches, email templates, AI message creation. |

2clics add-ons observed:

| Add-on | Public monthly price | Notes |
|--------|----------------------|-------|
| Instagram integration | ARS 38,603 per linked account | Property diffusion and AI-generated post descriptions. |
| WhatsApp integration | ARS 42,188 per linked account | Centralized WhatsApp conversations tied to deals/properties. |
| AI message creation | ARS 25,623 per linked account | AI-assisted replies based on property, inquiry, agent, and prospect data. |

2clics feature matrix observed from the public pricing page:

| Feature | Esencial | Avanzado | Profesional |
|---------|----------|----------|-------------|
| Unlimited properties | Yes | Yes | Yes |
| Real-estate network | Yes | Yes | Yes |
| Unlimited developments | No | Yes | Yes |
| Website | Yes | Yes | Yes |
| AI descriptions | Yes | Yes | Yes |
| SSL certificate | Yes | Yes | Yes |
| Email accounts | 5 | 7 | 9 |
| Users | 2 | 4 | 6 |
| Free portals | Yes | Yes | Yes |
| Premium portals | 2 | All | All |
| Deal management | No | Yes | Yes |
| Website blog | No | Yes | Yes |
| Property landing page | No | Yes | Yes |
| Private real-estate network | No | Yes | Yes |
| Calendar integration | No | No | Yes |
| Automatic replies | No | No | Yes |
| Email templates | No | No | Yes |
| Email integration | No | No | Yes |
| Branch management | No | No | Yes |

Compared with 2clics, AdPropIA's proposed pricing is higher at the lower tier but targets a different operational job: administration of rents, contracts, indexes, cash movements, payments, liquidations, and auditability. 2clics is a useful CRM/lead-management anchor, not the main rental-operations pricing anchor.

| Product | Market signal | Pricing / segmentation observed | Implication for AdPropIA |
|---------|---------------|----------------------------------|---------------------------|
| Barreeo | Argentina-focused rental administration software | Public ARS pricing by number of rentals: Basic up to 5, Commercial up to 25, Building up to 70, Unlimited. Monthly list prices observed: approx. ARS 14,997 / 39,559 / 59,997 / 97,167 after introductory discount period. | Strong local low-price anchor. AdPropIA should avoid racing to the bottom and should justify higher tiers with multi-client operations, auditability, indexes, liquidations, and professional onboarding. |
| Tokko Broker | Argentina/LatAm real-estate CRM | Public plans page: `https://www.tokkobroker.com/es-ar/planes`. Screenshot-confirmed monthly prices: Personal ARS 67,742 for 15 properties/1 user; Inicial ARS 132,967 for 40 properties/2 users; Equipo ARS 230,908 for 90 properties/4 users; Profesional ARS 367,185 for 200 properties/10 users; Corporativo ARS 637,551 for 300 properties/15 users. Prices are shown with a lower “sin impuestos nacionales” amount. | Strong Argentine benchmark for property/user segmentation. AdPropIA can sit below Tokko on price while positioning around rental operations, indexes, cash management, liquidations, and auditability rather than CRM/portal publication. |
| 2clics | Argentina-focused real-estate CRM | Public monthly prices: Esencial ARS 57,118, Avanzado ARS 95,603, Profesional ARS 163,911. Add-ons include Instagram ARS 38,603, WhatsApp ARS 42,188, and AI messages ARS 25,623 per linked account. | Useful CRM and lead-management benchmark. AdPropIA should not compare feature-for-feature with CRM tools; it should emphasize rental administration depth, cash management, indexes, liquidations, and audit traceability. |
| Alquilando | Colombia/LatAm rental ecosystem | Emphasizes ecosystem, digital operation, partner models, payments, contracts, and tracking. Public pricing was not the main acquisition pattern in fetched content. | Supports the idea that assisted/partnership onboarding is valid for real-estate operations, especially when the product changes operational process. |
| Buildium | US property management SaaS | Public starting prices: Essential USD 62/month, Growth USD 192/month, Premium USD 400/month. | Useful upper-market reference, but not directly portable to Argentina. Shows that public plan ladders are normal. |
| Rentec Direct | US property management SaaS | Starts around USD 55–65/month and scales by unit count. | Reinforces unit-count pricing as the main billing dimension. |
| DoorLoop | US property management SaaS | Starts around USD 69/month for first 10 units, then per-unit economics and higher Pro/Premium plans. | Reinforces combining a monthly floor with unit-based segmentation. |
| AppFolio | US enterprise property management SaaS | Quote-based with unit minimums. | Supports `A medida` for larger operators rather than forcing public self-service pricing. |

## Assisted plan recommender

The `/request-access` flow should ask for enough information to recommend a plan without creating operational records.

Recommended v1 fields:

- company or agency name,
- contact name,
- email,
- optional phone,
- approximate unit/property count,
- expected number of internal users,
- current operation pain point or message,
- optional feature interests: index adjustments, cash management, liquidations, owner reporting, audit trail, payment tracking.

The output should say:

> Based on your operation, we recommend the `<plan>` plan. We will contact you to validate the setup and activate the workspace.

Do not promise automatic activation in v1.

## Pricing caveats

- Prices are internal baseline candidates and can change before launch.
- Public prices should include a short note: “Final plan confirmed during assisted activation.”
- If annual billing is introduced, start with a simple discount later; do not include annual billing in the first request-access slice.
- Do not create tenants, users, or Auth0 Organizations from the public form in v1.

## Future v2

V2 can add a super-admin panel for AdPropIA to review leads and approve provisioning:

1. Review request-access lead.
2. Confirm or adjust plan.
3. Create Auth0 Organization.
4. Create `tenants` row with `auth0OrgId`.
5. Create or link the initial admin user.
6. Create `tenant_users` membership.
7. Set tenant plan, limits, features, and onboarding status.

This keeps the public funnel commercial while preserving controlled tenant provisioning.
