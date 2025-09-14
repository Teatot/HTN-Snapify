import { useState } from "react";
import axios from "axios";
import "./App.css";

function dragOverride({ product, onDragStart, x = null, y = null }) {
  return (e) => {
    onDragStart(product, x, y);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", product.id);

    // Create a temporary drag image
    const dragImg = new Image();
    dragImg.src = product.images.edges[0]?.node.url;
    dragImg.width = 64;
    dragImg.height = 64;

    dragImg.onload = () => {
      e.dataTransfer.setDragImage(
        dragImg,
        dragImg.width / 2,
        dragImg.height / 2
      );
    };
  };
}

function Tooltip({ product }) {
  const [isDragging, setIsDragging] = useState(false);
  const productUrl = `https://shop.app/products/${product.handle || product.id}`;

  // Truncate title if too long
  const truncatedTitle =
    product.title.length > 30
      ? product.title.slice(0, 30) + "..."
      : product.title;

  return (
    <div
      className="absolute bg-black -top-21 -right-28 z-10 p-2 hidden group-hover:block border border-white pointer-events-none"
    >
      {/* Re-enable pointer events for actual content */}
      <div 
        className="pointer-events-auto bg-black text-white text-l z-10 px-2 rounded-lg shadow-lg whitespace-nowrap" 
        draggable={false}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <h1 className="text-xl">{truncatedTitle}</h1>
        <h2>{`$${Number(product.variants.edges[0].node.price.amount).toFixed(2)} (CAD)`}</h2>
        <div className="flex items-center gap-2">
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-400 hover:text-blue-600"
            draggable={false}
          >
            Product Link
          </a>
          <img
            src="https://i.postimg.cc/X7ghMy8N/image-removebg-preview.png"
            className="h-6"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

function Furniture({ product, onDragStart }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`w-20 relative group overflow-visible hover:border hover:rounded-xl hover:border-4 hover:border-green-200`}
      onMouseOver={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <img
        src={product.images.edges[0]?.node.url}
        alt={product.title}
        className="aspect-square w-full object-cover rounded-lg cursor-grab"
        draggable
        onDragStart={dragOverride({ product, onDragStart })}
      />
      <Tooltip product={product} />
    </div>
  );
}

function GridSlot({ x, y, furniture, onDrop, onDragStart, isCenter }) {
  return (
    <div
      onDragOver={(e) => !isCenter && e.preventDefault()}
      onDrop={() => !isCenter && onDrop(x, y)}
      className={`aspect-square border border-gray-500 flex items-center justify-center ${
        furniture ? "" : "bg-black"
      } relative ${isCenter ? "pointer-events-none" : ""}`}
    >
      {isCenter && (
        <span className="text-white font-bold text-lg absolute pointer-events-none select-none">
          You
        </span>
      )}
      {furniture && !isCenter && (
        <div
          draggable
          onDragStart={dragOverride({ product: furniture, onDragStart, x, y })}
          className="w-full h-full relative group cursor-grab"
        >
          <img
            src={furniture.images.edges[0]?.node.url}
            alt={furniture.title}
            className="w-full h-full object-cover rounded"
          />
          <Tooltip product={furniture}></Tooltip>
        </div>
      )}
    </div>
  );
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const shops = [
    "highfashionhome",
    "furnituremaxi",
    "thronekingdom",
    "chicoryhome",
    "furnitureofcanada",
    "furniturebarn",
    "thegoatwallart",
    "ruggable",
    "consciousitems",
  ];

  const [grid, setGrid] = useState(
    Array.from({ length: 7 }, () => Array(7).fill(null))
  );
  const [draggingProduct, setDraggingProduct] = useState(null);
  const [draggingFromGrid, setDraggingFromGrid] = useState(null); // track grid source

  const handleDragStart = (product, x = null, y = null) => {
    setDraggingProduct(product);
    if (x !== null && y !== null) setDraggingFromGrid({ x, y });
  };

  const handleDrop = async (x, y) => {
    if (!draggingProduct) return;

    // Prevent dropping onto the same spot
    if (draggingFromGrid && draggingFromGrid.x === x && draggingFromGrid.y === y) {
      setDraggingProduct(null);
      setDraggingFromGrid(null);
      return;
    }

    setGrid((prev) => {
      const newGrid = prev.map((row) => [...row]);

      // Prevent overwriting another product accidentally
      if (newGrid[y][x]?.id === draggingProduct.id) return newGrid;

      newGrid[y][x] = draggingProduct;

      // Remove original if dragging from grid
      if (draggingFromGrid) {
        newGrid[draggingFromGrid.y][draggingFromGrid.x] = null;
      }

      updateBackendGrid(newGrid);
      return newGrid;
    });

    // Remove from inventory if not dragging from grid
    if (!draggingFromGrid) {
      setProducts((prev) => prev.filter((p) => p.id !== draggingProduct.id));
    }

    setDraggingProduct(null);
    setDraggingFromGrid(null);
  };

  const updateBackendGrid = async (gridState) => {
    try {
      // Transform grid into the format your teammate wants
      const gridProducts = [];

      gridState.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell) {
            gridProducts.push([cell.id, x, y]);
          }
        });
      });

      await axios.post("http://localhost:4000/api/update-grid", {
        grid: gridProducts,
      });
      console.log("Backend grid updated!", gridProducts);
    } catch (err) {
      console.error("Failed to update backend grid:", err);
    }
  };

  const fetchShopifyProducts = async (prompt) => {
    const allProducts = [];
    await Promise.all(
      shops.map(async (shop) => {
        const url = `https://${shop}.myshopify.com/api/2025-07/graphql.json`;
        const query = `{
          products(first: 10, query: "${prompt}") {
            edges {
              node {
                id
                title
                description
                productType
                images(first: 1) {
                  edges {
                    node { url }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          const data = await res.json();
          const shopProducts = data.data.products.edges.map((e) => e.node);
          allProducts.push(...shopProducts);
        } catch (err) {
          console.error(`Error fetching from ${shop}:`, err);
        }
      })
    );
    console.log(allProducts);
    return allProducts;
  };

  const getRecommendedProductIds = async (allProducts, userPrompt) => {
    try {
      const { data } = await axios.post("http://localhost:4000/api/recommend", {
        products: allProducts,
        prompt: userPrompt,
      });
      console.log(data.recommendedIds, data.theme);
      return {
        recommendedIds: data.recommendedIds || [],
        theme: data.theme || "cozy",
      };
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      return {
        recommendedIds: [],
        theme: "cozy",
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);

    // Reset grid locally
    const emptyGrid = Array.from({ length: 7 }, () => Array(7).fill(null));
    setGrid(emptyGrid);
    setProducts([]);

    // Reset grid on backend
    await updateBackendGrid(emptyGrid);

    const allProducts = await fetchShopifyProducts(prompt);
    const { recommendedIds, theme } = await getRecommendedProductIds(
      allProducts,
      prompt
    );

    let filteredProducts = allProducts.filter((p) =>
      recommendedIds.includes(p.id.split("/").pop())
    );

    // Set the theme for extraProducts selection
    setTheme(theme);

    // --- Hardcoded product ---
    const extraProducts = {
      cozy: [
        {
          id: "7198596628549",
          title: "Avery Velvet Reversible Corner Sofa Bed With Storage Chaise",
          description:
            "The Essential Velvet Reversible Corner Sofa Bed with Storage Chaise is more than just a piece of furniture; it's a versatile solution that adapts to your lifestyle. Whether you're looking to maximize your space with functional furniture or elevate your home decor with a touch of velvet luxury, this sofa bed is designed to meet your needs. Effortlessly transform the sofa into a bed within seconds. Whether accommodating overnight guests or enjoying a lazy weekend at home, this feature offers the ultimate convenience. Practicality meets style with the built-in storage chaise. Perfect for organizing living room essentials, the storage space ensures that your living area remains clutter-free while keeping your necessities within easy reach. Wrap yourself in the plush, soft touch of premium velvet, providing both an indulgent feel and a splash of opulence to your interior decor. At its core, the Essential sofa boasts a sturdy wooden frame that ensures longevity and durability. Colour: Choose from Mustard/Dark Blue/ Grey/Beige Decorations and scatter pillows are not included 👈👉 Lefty or Righty? Versatile Set has got you covered, you can put either right hand side or left hand side",
          productType: "Sofas & Armchairs",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/1618/6251/files/thumbnail_f950ee6a-dc28-40d7-a5f1-5b15d583843a.jpg?v=1748439245",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "499.99",
                    currencyCode: "GBP",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7242646618181",
          title: "Boho 6 Drawers Chest Rattan Decorated Storage TV Cabinet",
          description:
            "Get ready to fall in love with the ultimate blend of functionality and style - our Boho 6 Drawers Chest Rattan Decorated Storage TV Cabinet is here to transform your space with its unique flair and unparalleled practicality! Crafted with care, this piece features a robust 15/12mm particle board adorned with melamine paper for that sleek, durable finish we all crave. And those legs? Solid wood with a sophisticated black paint job that screams elegance! Bringing that industrial chic vibe right into your living room, bedroom, or wherever you choose to showcase this beauty. With smooth sliding rails, accessing your belongings is a breeze - say goodbye to the tug-of-war with stuck drawers.",
          productType: "Bedroom Furniture",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/1618/6251/files/BOHO023BLACK_11.jpg?v=1716346155",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "149.99",
                    currencyCode: "GBP",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7221918859333",
          title: "Belluno 120cm Oval Coffee Table In Oak",
          description:
            "The Belluno coffee table stands out for its harmonious blend of form and function. Invite the Belluno into your home and infuse your dining area with a touch of sophistication that never goes out of style. The utilization of MDF with paper veneer in both the table top and legs sets this table apart from its contemporaries, offering a consistent aesthetic that exudes modern elegance. Its oval shape not only maximizes seating capacity but also fosters a more inclusive atmosphere at meals, ensuring that everyone feels part of the conversation.",
          productType: "Living Room Furniture",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/1618/6251/files/BELLUNO056OAK_11.jpg?v=1716345314",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "229.99",
                    currencyCode: "GBP",
                  },
                },
              },
            ],
          },
        },
      ],
      modern: [
        {
          id: "7272726954059",
          title: "Tatum Dining Chair, Cream",
          description:
            "The Tatum Dining Chair enhances your dining space with its art deco-inspired design, combining artistic flair with modern functionality. Upholstered in highly textured, liquid-repellent fabric that’s easy to clean, it offers a polished look alongside exceptional practicality. A perfect blend of comfort and style for any contemporary dining room.",
          productType: "Furniture - Dining",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/TatumDiningChair_Cream1.jpg?v=1734731717",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "349.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "4668497166411",
          title: "Montana Dining Table, Gray/Gold Base",
          description:
            "The high drama of the Montana Dining Table with its sweeping, golden base will surely stand out in any room. The oval tabletop that looks like marble is in fact durable, Italian ceramic that’s stain, heat and scratch-resistant.",
          productType: "Furniture - Dining",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/products/MontanaDiningTable_GrayGoldBase1.jpg?v=1619818091",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "2599.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "6839446765643",
          title: "Huxford Floor Lamp",
          description:
            "The Huxford Floor Lamp combines timeless design with modern functionality. Crafted from iron with a plated antique brushed brass finish, it exudes classic elegance. The lamp stands on a thick black marble foot, displaying natural veining for added sophistication. The suspended round hardback shade, covered in white linen fabric, can be angled as desired due to the pivoting neck. Illuminate your space with the Huxford Floor Lamp—an exquisite blend of style and versatility that effortlessly enhances any room with its understated charm.",
          productType: "Lighting",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/HuxfordFloorLamp1.jpg?v=1695928422",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "631.4",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
      ],
      gothic: [
        {
          id: "14612445102452",
          title: "Chloe Throne Chair - Vinyl",
          description:
            'Add a regal touch to your life with the Chloe Throne Chair, a statement piece designed to elevate any space or event. This magnificent throne chair offers unmatched comfort, combining plush seating with a stunning design that exudes sophistication. Whether you\'re hosting a lavish wedding, a luxurious birthday celebration, or any event that demands a touch of opulence, the Chloe Throne Chair is the perfect choice.For Homeowners: Transform your living space into a sanctuary of luxury with this show-stopping throne chair. Perfect for creating a special nook in your home, it offers a unique blend of comfort and elegance. With its rich, regal design, the Chloe Throne Chair allows you to unwind like royalty, making it an ideal addition to your living room, study, or personal space.For Event Planners: Looking for the perfect throne to make your event unforgettable? The Chloe Throne Chair brings undeniable flair and prestige to weddings, engagements, or any high-end event. Its stunning design and plush comfort ensure that your VIPs will feel like true royalty.For Business Owners: Impress your clients, elevate your brand, and add a touch of grandeur to your business with the Chloe Throne Chair. Whether it\'s a beauty salon, boutique, or luxury hotel, this chair makes a bold statement, creating a memorable atmosphere and offering unmatched comfort for your guests.Sit back, relax, and bask in the luxury that the Chloe Throne Chair brings. Perfect for every grand occasion, this chair will add a touch of royalty to your life. - Hand Chiseled from grade A mahogany wood- Premium upholstery materials for commercial use- Clear protective coating for enhanced color and longevity- Upholstery can be optioned with buttons or crystal tufting- Nail head trimming- Actual product colors may vary slightly from those shown on your screen. Contact us directly to see the live product before purchasing. Height: 70"Width: 36"Depth: 27"Floor to seat: 17"Floor to arm: 30"Product weight: 70 lbs.Weight capacity: 350 lbs. Allow 1–2 inches for variation in crafting of the frame.Fits through a standard 30" doorway.',
          productType: "Queen Throne",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/2175/2953/files/wing_2024-07-25T17_51_10.182Z_6ca687c7-357f-41fa-a31d-ba0ccd575a0c.png?v=1734464829",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "995.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7330042019915",
          title: "Bambi Dining Table, Black",
          description:
            "The Bambi Ash Dining Table combines timeless style with modern sensibility. Featuring a durable ash veneer and bold clover-shaped legs, it exudes both strength and charm. The thick, sturdy tabletop adds a statement touch, while the wabi-sabi influence brings a unique, organic elegance to your dining space.",
          productType: "Furniture - Dining",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/BambiBlackAshDiningTable1.jpg?v=1755417948",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "1299.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7407366602827",
          title: "Emberdale Floor Lamp, Black",
          description:
            "The Emberdale Floor Lamp features a tall, slender profile with a minimalist metal frame and a linen shade that diffuses light softly. Perfect for living rooms, bedrooms, or reading corners where vertical illumination is needed.",
          productType: "Lighting",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/EmberdaleFloorLamp_Black1.jpg?v=1753690870",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "199.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
      ],
      nature: [
        {
          id: "7332361175115",
          title: "Spencer Leather Swivel Chair, Nature 210-133",
          description:
            "The Spencer Leather Swivel Chair combines style and comfort with its barrel back design, channeled details, and rolled arms. Contrasting hair-on-hide accents add texture, while semi-aniline leather upholstery provides a luxurious feel. Supported by a durable frame and featuring a swivel base, this chair offers both elegance and functionality, making it a perfect addition to any modern living space.",
          productType: "Furniture - Chair",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/CC802-SW-078-1.jpg?v=1755417543",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "2279.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7014066061387",
          title: "Cypress Root Coffee Table, Natural",
          description:
            "Experience the epitome of organic beauty with our Cypress Root Coffee Table. Meticulously crafted from teak root, each piece exudes unique character, showcasing the intricate grains and natural imperfections of the wood. This coffee table seamlessly blends rustic charm with modern elegance, making it a captivating centerpiece for any living space. Whether you're enjoying a cozy evening in or entertaining guests, the Cypress Root Coffee Table adds a touch of natural sophistication to your home decor.",
          productType: "Furniture - Accent Tables",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/51005386_1.jpg?v=1712853529",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "1050.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7422418550859",
          title: "Faux Olive Tree by Four Hands",
          description:
            "Available online only. Ships directly from the vendor. Dense foliage and expertly crafted branches give this faux olive tree a lifelike presence without the upkeep. Designed to replicate the natural look of a fruitless olive, it adds greenery and texture to any space with effortless style. The tree ships in a sleek black plastic liner pot, making it easy to display and maintain. Perfect for adding a touch of nature indoors, it offers the beauty of lush foliage without the need for watering or pruning.",
          productType: "Accessories",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/FauxOliveTree3.jpg?v=1755713599",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "529.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
      ],
      urban: [
        {
          id: "3946155114571",
          title: "Keppler Square Coffee Table by Four Hands",
          description:
            "Available online only. Ships directly from the manufacturer. A light look for a substantial feel, the Keppler Square Coffee Table has a side of industrial edge.",
          productType: "Furniture - Accent Tables",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/products/keppler_square_coffee_table_3.jpg?v=1587455112",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "1249.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7288206950475",
          title: "Smart Barstool, Charcoal, Set of 2",
          description:
            "This barstool's seat and back are built with a sculpted design for comfort, It's upholstered in a soft 100% Polyurethane fabric, with a slim profile metal base and two crossbars for stability. The frame is finished in matte black, for a universal appeal.",
          productType: "Furniture",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/109327_01.jpg?v=1747642277",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "357.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
        {
          id: "7407343272011",
          title: "Steamport Floor Lamp, Gold",
          description:
            "The Steamport Floor Lamp delivers a bold industrial-inspired design with its tall stature and striking metal framework. Perfect for lofts or modern interiors seeking a statement lighting piece.",
          productType: "Lighting",
          images: {
            edges: [
              {
                node: {
                  url: "https://cdn.shopify.com/s/files/1/0225/2528/0331/files/SteamportFloorLamp_Gold1.jpg?v=1753689799",
                },
              },
            ],
          },
          variants: {
            edges: [
              {
                node: {
                  price: {
                    amount: "299.0",
                    currencyCode: "USD",
                  },
                },
              },
            ],
          },
        },
      ],
    };

    // Add extraProducts if they don't already exist
    if (extraProducts[theme]) {
      extraProducts[theme].forEach((extraProduct) => {
        if (!filteredProducts.some((p) => p.id === extraProduct.id)) {
          filteredProducts.push(extraProduct);
        }
      });
    }

    //Normalize ids
    filteredProducts = filteredProducts.map((p) => ({
      ...p,
      id: p.id.split("/").pop(),
    }));

    setProducts(filteredProducts);
    setPrompt("");
    setLoading(false);
    // Note: Don't reset theme as it's needed for extraProducts selection
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[radial-gradient(circle_at_top_left,_#212121,_#121212)]">
      <div className="max-w-3xl w-full flex flex-col items-center gap-6">
        <img
          src="https://i.postimg.cc/ncM7xyKs/image-removebg-preview-2.png"
          className="h-32"
        ></img>
        <div className="text-center">
          <h1
            className="text-7xl font-semibold mb-2 mt-[-6px]
            bg-gradient-to-r from-green-400 to-yellow-400
            bg-clip-text text-transparent leading-[1.4]"
          >
            Snapify
          </h1>
          <p className="mt-4 text-2xl text-chat-placeholder font-normal relative after:content-['|'] after:ml-1 after:animate-blink typing-animation">
            How can I help you today?
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-end bg-[#303030] rounded-3xl p-3 transition-all duration-200">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What vibe are you feeling ?"
                className="flex-1 bg-transparent border-none outline-none text-l leading-6 resize-none min-h-24 max-h-48 font-inherit placeholder-chat-placeholder"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                className={`ml-2 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0 ${
                  prompt.trim()
                    ? "bg-white text-black hover:bg-gray-200 cursor-pointer"
                    : "hidden"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-black"
                >
                  <path
                    d="M7 11L12 6L17 11M12 18V7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>
          {/* Loading message */}
          {loading && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <img
                src="https://i.postimg.cc/ncM7xyKs/image-removebg-preview-2.png"
                className="h-12 loading-rotate"
                alt="Snapify Loading"
              />
              <p className="text-chat-placeholder text-xs text-center">
                Snapify is generating your vibe...
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full flex mt-12">
        <div className="w-47/100 flex flex-col items-center">
          {/* Inventory */}
          <h1 className={`mb-0 text-2xl font-bold`}>Inventory</h1>
          <div
            className="w-7/10 flex flex-wrap gap-2 content-center justify-center min-h-24 bg-[#272727] mt-2"
            onDragOver={(e) => e.preventDefault()} // allow dropping
            onDrop={() => {
              if (!draggingProduct) return;

              // Remove from grid if dragging from there
              if (draggingFromGrid) {
                setGrid((prev) => {
                  const newGrid = prev.map((row) => [...row]);
                  newGrid[draggingFromGrid.y][draggingFromGrid.x] = null;
                  updateBackendGrid(newGrid);
                  return newGrid;
                });
                setDraggingFromGrid(null);
              }

              // Add back to inventory
              setProducts((prev) => [...prev, draggingProduct]);
              setDraggingProduct(null);
            }}
          >
            {products.length > 0 ? (
              products.map((product) => (
                <Furniture
                  key={product.id}
                  product={product}
                  onDragStart={handleDragStart}
                />
              ))
            ) : (
              <div className="text-[#AEAEAE]">Empty Inventory</div>
            )}
          </div>
        </div>

        <div className="w-53/100 flex flex-col items-center">
          {/* Room Grid */}
          <h1 className="mb-0 text-2xl font-bold">Room Layout</h1>
          <div className="w-full max-w-xl grid grid-cols-7 gap-1 mt-3 p-1 border-4 border-[#787878] rounded-xl">
            {grid.map((row, y) =>
              row.map((slot, x) => (
                <GridSlot
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  furniture={slot}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  isCenter={x === 3 && y === 3} // 0-based center
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
