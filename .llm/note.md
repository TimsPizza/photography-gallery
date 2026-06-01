## my dev note

---- ui design ----

1. liquid-glassified navbar and a bg blur，整体ui设计色为暖黄/淡灰对应light/dark mode，字体依旧LXGW wenkai
2. react bits仍然值得用
3. don't make 'contact me' as I have a developer portfolio as well.
4. do I want it to be single-paged(vertically or z-stacked) to minimize navigations? as it will break the 'immersion'
5. hmmm, single-paged is good, with modal, but hard to design?
6. 12-grid layout, perfect for typical 3:2 or 2:3 photos, paddings may apply, also is mobile-frendly and easy for auto-layout
7. also, use the..what's that called? smooth-scrolling? oh, lenis, but i think there's a lighter-weighted one

---- features ----

1. Manually tag photos
2. automatic-similar-color-matching algorithm, like what google does (called 'mood mode'), also added to tag, but done while uploading. k-means? maybe too heavy.
3. cloudflare d1 as app database for tags, file urls, etc, also use the cf wrapper api for file handling/serving, so we do not consider file handling perf here
4. need to auto-detect the orientation, hmm, I need a layout calculator, tied with the layout component itself
5.

---- others ----

1. users may just come in from no where, and they may have no specific exploration purpose at all, so just make it neat, smooth and fast-loading
2. it is a gallery/photo wall, with advanced features like auto grouping by color, and can be viewed by category, or I can even make an album (create/edit album -> select photos -> auto/manual layout). Oh wait, album needs a different layout for immersive showcase
