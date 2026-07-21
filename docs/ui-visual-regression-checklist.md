# UI Visual Regression Checklist

এই checklist প্রতিটি release বা বড় UI change এর আগে follow করতে হবে।

## 1) Route Coverage

- [ ] Dashboard: `/`
- [ ] Leads List: `/leads`
- [ ] User Management: `/admin/users`
- [ ] Roles & Permissions: `/admin/roles`
- [ ] Login: `/login`
- [ ] Register: `/register`

## 2) Viewport Coverage

- [ ] Mobile: `390x844`
- [ ] Tablet: `768x1024`
- [ ] Desktop: `1366x768`
- [ ] Wide Desktop: `1536x960`

## 3) Layout & Spacing

- [ ] Sidebar open/close behaviour ঠিক আছে
- [ ] Mobile এ sidebar backdrop close কাজ করছে
- [ ] Main content padding সব page এ consistent
- [ ] Header title/subtitle vertical alignment ঠিক আছে
- [ ] কোনো text overlap বা clipping নেই

## 4) Typography & Colors

- [ ] Primary font render হচ্ছে (Plus Jakarta Sans)
- [ ] Heading weights consistent
- [ ] Button color hierarchy consistent (primary/secondary/danger)
- [ ] Alert colors semantic (success/error/warning)
- [ ] Contrast visually readable (especially muted text)

## 5) Components

- [ ] Card radius/shadow/spacing consistent
- [ ] Table header background এবং row borders consistent
- [ ] Form input focus state visible
- [ ] Icon alignment text baseline এর সাথে ঠিক আছে
- [ ] CTA hover state smooth

## 6) Leads-Specific Checks

- [ ] Leads header title/count desktop এ wrap-bug ছাড়া render হয়
- [ ] Realtime control, badges, action buttons overflow করে না
- [ ] Card view actions mobile এ accessible
- [ ] Filters section horizontal overflow করে না
- [ ] Lead table ও mobile card-এ Last Updated date/time readable এবং Dhaka timezone-এ consistent
- [ ] Narrow desktop-এ lead table horizontal scroll করলে sticky Actions column usable থাকে
- [ ] Activity Report table-এ lead identity, role badge, action badge এবং description overlap ছাড়া render হয়
- [ ] Bulk activity lead list expand/collapse এবং internal scroll usable থাকে
- [ ] Recent Activity pagination active filters preserve করে

## 7) Auth Pages

- [ ] Login/Register hero panel alignment ঠিক আছে
- [ ] Form blocks vertical rhythm consistent
- [ ] Primary CTA both pages এ same style

## 8) Smoke Functional Checks

- [ ] Add User modal open/close
- [ ] Role update form submit button visible and clickable
- [ ] Leads page main actions clickable
- [ ] Navigation active state current route-এ সঠিক

## 9) Suggested Automation (future)

- Playwright screenshot baseline maintain করুন:
  - per route x per viewport snapshot
  - visual diff threshold set করুন (e.g. 0.1%-0.5%)
- CI তে visual regression step বাধ্যতামূলক করুন
