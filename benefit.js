import { benefitTypes, typesIconPaths, categoriesInfo, benefitConfMessages } from "../constants/benefit-data.js";

let benefits;
let cartItems = [];
let benefitCancelId = 0;
let usedPoints = 0;
const totalPoints = 440;
let buyButton;
const loadingOverlay = document.getElementById("loading-overlay");
const leadData = JSON.parse(sessionStorage.getItem("leadData"));
let modal, openModalBtn, closeModalBtn;
let modal2, cancellationComent, submitCancelButton, closeModal22;
let modal3, confirm3btn, cancel3btn;
let smartfitModal;
let smartfitSearchInput;
let smartfitLocationsList;
let smartfitConfirmBtn;
let selectedSmartfitSede = null;
let smartfitBenefitToAdd = null;
let lastClickedAddToCartBtn;
let benefitsToCancel = [];

function showError(message) {
  Swal.fire({
    icon: "error",
    title: "Oops...",
    text: message || "Ha ocurrido un error inesperado.",
    confirmButtonColor: "#e53935",
  });
}

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
};

function getBenefits() {
  validateToken(".");
  loadingOverlay.classList.replace("invisible", "visible");

  fetch(window.env.API_URL + "/api/benefit/all", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${leadData.token}`,
    },
  })
    .then((response) => response.json())
    .then((response) => {
      if (!response.success) {
        showError(response.errors[0]);
      } else {
        benefits = response.data.benefits;

        usedPoints = totalPoints - response.data.availablePoints;
        updatePoints();

        const activeBenefits = benefits.filter(
          (benefit) =>
            !benefit.canBeAdded &&
            !benefit.isCancel &&
            benefit.renovationDate.length > 0
        );
        const availableBenefits = benefits.filter(
          (benefit) => benefit.canBeAdded
        );
        const unavailableBenefits = benefits.filter(
          (benefit) => !benefit.canBeAdded && benefit.renovationDate.length == 0
        );
        const canceledBenefits = benefits.filter((benefit) => benefit.isCancel);

        renderBenefitCards(
          activeBenefits,
          availableBenefits,
          unavailableBenefits,
          canceledBenefits
        );
        attachBenefitCardListeners();
      }
    })
    .catch((error) => {
      showError(error.description);
    })
    .finally(() => {
      loadingOverlay.classList.replace("visible", "invisible");
    });
}
function openSmartfitModal(benefit) {
  smartfitBenefitToAdd = benefit;
  if (smartfitModal) {
    smartfitModal.style.display = "flex";
    fetchSmartfitLocations("");
  }
}
function closeSmartfitModal(cleanSmartfitSede = true) {
  if (smartfitModal) {
    smartfitModal.style.display = "none";
    smartfitSearchInput.value = "";
    if (cleanSmartfitSede) {
      selectedSmartfitSede = null;
    }
  }
}
function fetchSmartfitLocations(query) {
  const url = `${window.env.API_URL
    }/api/benefit/smartfit?description=${encodeURIComponent(query)}`;
  loadingOverlay.classList.replace("invisible", "visible");

  fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${leadData.token}`,
    },
  })
    .then((response) => {
      console.log("Respuesta de la API de Smartfit:", response);
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then((response) => {
      console.log("Datos de la API de Smartfit (JSON):", response);

      if (!response.success) {
        showError(response.errors[0]);
      } else {
        if (response.data && Array.isArray(response.data)) {
          const locations = response.data.map((item) => ({
            id: item.id,
            sede: item.description,
            ciudad: "",
          }));
          renderSmartfitLocations(locations);
        } else {
          showError(
            "La respuesta de la API no contiene el formato de datos esperado."
          );
        }
      }
    })
    .catch((error) => {
      console.error(
        "Error completo al cargar las ubicaciones de Smartfit:",
        error
      );
      showError(
        `Error al cargar las ubicaciones de Smartfit: ${error.message}`
      );
    })
    .finally(() => {
      loadingOverlay.classList.replace("visible", "invisible");
    });
}
function renderSmartfitLocations(locations) {
  if (!smartfitLocationsList) return;
  smartfitLocationsList.innerHTML = "";

  const query = smartfitSearchInput.value.toLowerCase();
  const filteredLocations = locations.filter((location) =>
    location.sede.toLowerCase().includes(query)
  );

  if (filteredLocations.length === 0) {
    smartfitLocationsList.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">No locations found matching your search.</p>`;
  } else {
    filteredLocations.forEach((location) => {
      const locationItem = document.createElement("div");
      locationItem.classList.add("smartfit-location-item");
      locationItem.innerHTML = `<p><strong>${location.sede}</strong></p><p>${location.ciudad}</p>`;

      locationItem.addEventListener("click", () => {
        selectedSmartfitSede = location;
        document
          .querySelectorAll(".smartfit-location-item")
          .forEach((item) => item.classList.remove("selected"));
        locationItem.classList.add("selected");
        console.log("Sede seleccionada:", selectedSmartfitSede);

        const dropdownHeader = document.querySelector(
          "#smartfit-modal .dropdown-header"
        );
        const dropdownList = document.querySelector(
          "#smartfit-modal .dropdown-list"
        );
        const headerTextSpan = dropdownHeader.querySelector("span");

        if (headerTextSpan) {
          headerTextSpan.textContent = location.sede;
        }
        if (dropdownList) {
          dropdownList.classList.remove("active");
        }
        if (dropdownHeader) {
          dropdownHeader.classList.remove("active");
        }
      });
      smartfitLocationsList.appendChild(locationItem);
    });
  }
}
const debouncedSearch = debounce((query) => {
  fetchSmartfitLocations(query);
}, 500);

function validateCompleteCategory(incomingBenefit) {
  let missingCategories = [];
  let activeBenefits = benefits.filter(b => !b.canBeAdded && !b.isCancel && b.renovationDate.length > 0);
  let benefitsToCompare = cartItems.concat(activeBenefits);
  benefitsToCompare.push(incomingBenefit);

  const presentBenefitsCategories = benefitsToCompare.flatMap(b => b.categories);
  const presentCategoriesIds = presentBenefitsCategories.reduce((result, item) => {
    if (!result.some(c => c == item.id)) {
      result.push(item.id);
    }
    return result;
  }, []);

  if (presentCategoriesIds.includes(2)) {
    if (!presentCategoriesIds.includes(1)) missingCategories.push(categoriesInfo.find(x => x.id == 1).name);
    if (!presentCategoriesIds.includes(3)) missingCategories.push(categoriesInfo.find(x => x.id == 3).name);
  } else if (presentCategoriesIds.includes(3) && !presentCategoriesIds.includes(1)) {
    missingCategories.push(categoriesInfo.find(x => x.id == 1).name);
  }

  return missingCategories;
}

function attachBenefitCardListeners() {
  const addToCartButtons = document.querySelectorAll(".add-to-cart-btn");
  console.log("Listeners de tarjetas adjuntados.");

  addToCartButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const benefitName = this.getAttribute("data-name");
      const benefit = benefits.find((b) => b.benefit === benefitName);
      if (benefit) {
        if (benefitName === "Smartfit") {
          openSmartfitModal(benefit);
          return;
        }

        const missingCategories = validateCompleteCategory(benefit);
        if (missingCategories.length > 0) {
          let categoriesNames = missingCategories;
          let formattedList;
          const last = categoriesNames.pop();
          formattedList = categoriesNames.length > 0 ? categoriesNames.join(', ') + ' and ' + last : last;

          Swal.fire({
            icon: "warning",
            title: "Incomplete Category Alert",
            text: `To activate this product, you must select at least one item in each of the following categories: ${formattedList}. Without this selection, it will not be possible to redeem the product.`,
            confirmButtonText: "OK",
            confirmButtonColor: "#00897b",
          })
          return;
        }

        const potentialUsedPoints =
          cartItems.reduce((sum, item) => sum + item.points, usedPoints) +
          benefit.points;
        if (potentialUsedPoints > totalPoints) {
          Swal.fire({
            icon: "warning",
            title: "Not enough points!",
            text: "You do not have enough points to add this benefit.",
            confirmButtonText: "OK",
            confirmButtonColor: "#00897b",
          });
          return;
        }

        if (modal3) {
          lastClickedAddToCartBtn = this;
          confirm3btn.benefitId = benefit.id;
          displayConfirmationModal(benefit);
        }
      }
    });
  });

  const cancelButtons = document.querySelectorAll(".button-cancel");
  cancelButtons.forEach((buttonC) => {
    buttonC.addEventListener("click", function () {
      const benefitName = this.getAttribute("data-name");
      const benefit = benefits.find((b) => b.benefit === benefitName);
      if (benefit) {
        benefitCancelId = benefit.id;
        if (modal2) modal2.style.display = "block";
      }
    });
  });
}

function displayConfirmationModal(benefit) {
  modal3.style.display = "flex";
  modal3.querySelector(".conf-title").textContent = benefitConfMessages[benefit.id].title;
  modal3.querySelector(".conf-message").textContent = benefitConfMessages[benefit.id].message;
}

function updatePoints() {
  const progressBarFill = document.querySelector(".progress-bar-fill");
  const availablePointsSpan = document.querySelector(".available-points span");
  const pointsUsedInfo = document.querySelector(".points-used-info");

  const newUsedPoints =
    cartItems.reduce((sum, item) => sum + item.points, 0) + usedPoints;
  const remainingPoints = totalPoints - newUsedPoints;
  const percentageUsed = (newUsedPoints / totalPoints) * 100;

  if (availablePointsSpan)
    availablePointsSpan.textContent = remainingPoints > 0 ? remainingPoints : 0;
  if (pointsUsedInfo)
    pointsUsedInfo.textContent = `You have used ${newUsedPoints} points.`;
  if (progressBarFill) progressBarFill.style.width = `${100 - percentageUsed}%`;
  updateCartCounter();
}

function updateCartCounter() {
  const cartImage = document.getElementById("openModal");
  if (!cartImage) return;

  const cartButtonContainer = cartImage.parentElement;
  let counterSpan = document.getElementById("cart-counter");

  if (!counterSpan) {
    counterSpan = document.createElement("span");
    counterSpan.id = "cart-counter";
    counterSpan.style.cssText = `
      position: absolute; top: 15px; right: 15px; background-color: #e53935;
      color: white; border-radius: 50%; font-size: 12px; font-weight: bold;
      min-width: 20px; text-align: center; transform: translate(50%, -50%);
    `;
    cartButtonContainer.style.position = "relative";
    cartButtonContainer.appendChild(counterSpan);
  }

  if (cartItems.length > 0) {
    counterSpan.style.display = "block";
    counterSpan.textContent = cartItems.length;
  } else {
    counterSpan.style.display = "none";
  }
}

function renderCartItems() {
  const cartContainer = document.querySelector(".contenido-modal");
  if (!cartContainer) return;
  cartContainer.innerHTML = "";

  if (cartItems.length === 0) {
    cartContainer.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Your cart is empty.</p>`;
  } else {
    cartItems.forEach((item, index) => {
      const type = benefitTypes[item.benefit] || "";
      const iconsPath = typesIconPaths[type] || "";

      const cartItemHTML = `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-placeholder-icon">
              <img src="${iconsPath}" alt="Icono de ${item.benefit
        }" class="cart-item-icon" />
            </div>
            <div class="cart-item-details">
              <p class="cart-item-name">${item.benefit}</p>
              ${item.smartFitId
          ? `<p class="cart-item-sede">Sede: ${item.smartFitSede}</p>`
          : ""
        }
              <span class="cart-item-points">${item.points} pts</span>
            </div>
          </div>
          <span class="cart-item-remove" data-index="${index}">&times;</span>
        </div>
      `;
      cartContainer.insertAdjacentHTML("beforeend", cartItemHTML);
    });

    const removeButtons = cartContainer.querySelectorAll(".cart-item-remove");
    removeButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const index = parseInt(this.getAttribute("data-index"));
        const removedItem = cartItems[index];

        const cardButton = document.querySelector(
          `.flex-items button[data-name="${removedItem.benefit}"]`
        );
        if (cardButton) {
          cardButton.classList.remove("selected-btn");
          cardButton.textContent = "Add to Cart";
          cardButton.disabled = false;
          cardButton.closest(".flex-items").classList.remove("selected-card");
        }

        cartItems.splice(index, 1);
        updatePoints();
        renderCartItems();
      });
    });
  }
}

function renderBenefitCards(
  activeBenefits,
  availableBenefits,
  unavailableBenefits,
  canceledBenefits
) {
  const benefitTitle = document.getElementById("benefit-title");
  benefitTitle.textContent = `Hello, ${leadData.name}`;
  const benefitsContainer = document.getElementById("benefits-container");
  if (!benefitsContainer) return;
  benefitsContainer.innerHTML = '';

  const generateCardHTML = (benefit) => {
    let buttonLabel = "Add to cart";
    let buttonClass = "add-to-cart-btn";
    let cardClass = "";
    let isDisabled = false;

    if (!benefit.canBeAdded && !benefit.isCancel && benefit.renovationDate.length > 0) {
      buttonLabel = "Cancel";
      buttonClass = "button-cancel";
      cardClass = "active-card";
    } else if (!benefit.canBeAdded && benefit.isCancel && benefit.renovationDate.length > 0) {
      buttonLabel = "Cancelled";
      buttonClass = "button-disabled";
      cardClass = "canceled-card";
      isDisabled = true;
    } else if (!benefit.canBeAdded) {
      buttonClass = "button-disabled";
      isDisabled = true;
    }

    const type = benefitTypes[benefit.benefit] || "";
    const iconsPath = typesIconPaths[type] || "";
    const typeClass = type.toLowerCase().replace(/\s+/g, "-");

    const generateCategoryIcon = (category) => {
      let path = categoriesInfo.find(x => x.id === category.id).icon_path;
      return `<img src="${path}" alt="${category.name}" title="${category.name}" />`
    }

    return `
      <div class="flex-items ${cardClass}">
        <div class="card-header">
          <div class="card-icon-container">
            <img src="${iconsPath}" class="benefit-icon ${typeClass}" alt="Icono de ${benefit.benefit}" class="benefit-icon" />
          </div>
          <div class="card-title-container">
            <h3>${benefit.benefit}</h3>
            <span class="card-points">${benefit.points} pts</span>
          </div>
        </div>
        <div class="boton-parrafo">
          <p class="card-description">${benefit.description}</p>
          ${benefit.canBeAdded ? "" : `<p class='card-description'>${benefit.renovationDate}</p>`}
        </div>
        <div class="card-bottom">
          <div class="categories-cont">
            <label>Covered Categories</label>
            <div>
              ${benefit.categories.map(generateCategoryIcon).join("")}
            </div>
          </div>
          <div class="content-center">
            <button class="${buttonClass}" data-name="${benefit.benefit}" ${isDisabled ? "disabled" : ""}>
              ${buttonLabel}
            </button>
          </div>
        </div>
      </div>
    `;
  };

  let htmlContent = "";

  if (activeBenefits.length > 0) {
    htmlContent += `
      <div class="benefits-section">
        <h2 class="category-title">Active Benefits</h2>
        <div class="benefits-group">
          ${activeBenefits.map(generateCardHTML).join("")}
        </div>
      </div>
    `;
  }

  if (availableBenefits.length || unavailableBenefits.length > 0) {
    htmlContent += `
      <div class="benefits-section">
        <h2 class="category-title">Available Benefits</h2>
        <div class="benefits-group">
          ${availableBenefits.map(generateCardHTML).join("")}
          ${unavailableBenefits.map(generateCardHTML).join("")}
        </div>
      </div>
    `;
  }

  if (canceledBenefits.length > 0) {
    htmlContent += `
      <div class="benefits-section">
        <h2 class="category-title">Canceled Benefits</h2>
        <div class="benefits-group">
          ${canceledBenefits.map(generateCardHTML).join("")}
        </div>
      </div>
    `;
  }

  benefitsContainer.innerHTML = htmlContent;
}

fetch("modal.html")
  .then((response) => response.text())
  .then((modalHtml) => {
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    return fetch("modalA.html");
  })
  .then((response) => response.text())
  .then((modalA_Html) => {
    document.body.insertAdjacentHTML("beforeend", modalA_Html)
    return fetch("modalC.html");
  })
  .then((response) => response.text())
  .then((modalC_Html) => {
    document.body.insertAdjacentHTML("beforeend", modalC_Html);

    modal = document.getElementById("myModal");
    openModalBtn = document.getElementById("openModal");
    closeModalBtn = document.getElementById("close-btn");
    modal2 = document.getElementById("commentModal");
    cancellationComent = document.getElementById("commentText");
    submitCancelButton = document.getElementById("submitCommentBtn");
    closeModal22 = document.getElementById("closeCommentModal");
    modal3 = document.getElementById("confirmationModal");
    cancel3btn = document.getElementById("modal3CancelBtn");
    confirm3btn = document.getElementById("modal3ConfirmBtn");

    smartfitModal = document.getElementById("smartfit-modal");
    smartfitSearchInput = document.querySelector("#smartfit-modal .search-box");
    smartfitLocationsList = document.querySelector(
      "#smartfit-modal .list-options"
    );
    smartfitConfirmBtn = document.querySelector("#smartfit-modal .confirm-btn");

    const dropdownHeader = document.querySelector(
      "#smartfit-modal .dropdown-header"
    );
    const dropdownListContainer = document.querySelector(
      "#smartfit-modal .dropdown-list"
    );

    if (dropdownHeader && dropdownListContainer) {
      dropdownHeader.addEventListener("click", () => {
        dropdownListContainer.classList.toggle("active");
      });
    }

    // búsqueda con debounce
    if (smartfitSearchInput) {
      smartfitSearchInput.addEventListener("input", (event) => {
        debouncedSearch(event.target.value);
      });
    }

    const smartfitCloseBtn = document.getElementById("close-btn-smartfit");
    if (smartfitCloseBtn) {
      smartfitCloseBtn.addEventListener("click", () => {
        closeSmartfitModal();
      });
    }

    window.addEventListener("click", (event) => {
      if (event.target === smartfitModal) {
        closeSmartfitModal();
      }
    });

    if (smartfitConfirmBtn) {
      smartfitConfirmBtn.addEventListener("click", () => {
        if (selectedSmartfitSede && smartfitBenefitToAdd) {
          const benefitWithSede = {
            ...smartfitBenefitToAdd,
            smartFitId: selectedSmartfitSede.smartfitId,
            smartFitSede: selectedSmartfitSede.sede,
          };
          cartItems.push(benefitWithSede);
          if (benefitWithSede) {
            modal.style.display = "flex";
            renderCartItems();
          }
          console.log(
            "Smartfit agregado al carrito con sede:",
            benefitWithSede
          );
          updatePoints();
          closeSmartfitModal(false);
          const smartfitCardButton = document.querySelector(
            `.add-to-cart-btn[data-name="Smartfit"]`
          );
          if (smartfitCardButton) {
            const card = smartfitCardButton.closest(".flex-items");
            card.classList.add("selected-card");
            smartfitCardButton.textContent = "Added to Cart";
            smartfitCardButton.classList.add("selected-btn");
            smartfitCardButton.disabled = true;
          }
        } else {
          showError("Por favor, selecciona una sede de Smartfit.");
        }
      });
    }

    const finalizePurchase = async (benefitsForApi) => {
      try {
        const response = await fetch(window.env.API_URL + "/api/benefit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${leadData.token}`,
          },
          body: JSON.stringify({
            benefits: benefitsForApi,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Error de servidor: ${response.status} ${response.statusText}`
          );
        }

        const apiResponse = await response.json();

        if (!apiResponse.success) {
          console.log("Error en la compra (API):", apiResponse.errors[0]);
          showError(apiResponse.errors[0]);
        } else {
          console.log("¡Compra exitosa!", apiResponse);
          Swal.fire({
            icon: "success",
            title: "Successfully purchased.",
            text: "Your purchase was successful.",
            confirmButtonColor: "#00897b",
          }).then(() => {
            if (modal) modal.style.display = "none";
            cartItems = [];
            window.location.reload();
          });
        }
      } catch (error) {
        console.error("Error de red o del servidor:", error);
        showError(error.message);
      } finally {
        loadingOverlay.classList.replace("visible", "invisible");
      }
    }

    const cancelSingleBenefit = async (benefitId, comment) => {
      const response = await fetch(window.env.API_URL + "/api/benefit/cancel", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${leadData.token}`,
        },
        body: JSON.stringify({
          benefitId: benefitId,
          comment: comment,
        }),
      });
      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error(`Error al cancelar beneficio ${benefitCancelId}: ${responseData.errors[0]}`);
      }
      return responseData;
    };

    buyButton = document.getElementById("buy-button-modal");
    if (buyButton) {
      buyButton.addEventListener("click", async () => {
        console.log("Ítems en el carrito:", selectedSmartfitSede);
        if (cartItems.length > 0) {
          const benefitsForApi = cartItems.map((item) => {
            if (item.id == 17) {
              return {
                id: item.id,
                smartFitId: selectedSmartfitSede.id,
              };
            }
            return { id: item.id };
          });

          try {
            loadingOverlay.classList.replace("invisible", "visible");
            if (benefitsToCancel && benefitsToCancel.length > 0) {
              console.log(`Iniciando cancelación de ${benefitsToCancel.length} beneficios...`);
              for (const benefitToCancel of benefitsToCancel) {
                await cancelSingleBenefit(benefitToCancel.id, benefitToCancel.comment);
              }
            }
            await finalizePurchase(benefitsForApi);
          } catch {
            console.error("Fallo crítico en la secuencia de compra:", error);
            showError(error.message || "An unknown error has ocurred. Try again.");
          }
        } else {
          console.log(
            "¡No hay ítems en el carrito! No se puede realizar la compra."
          );
        }
      });
    }

    if (openModalBtn) {
      openModalBtn.addEventListener("click", () => {
        if (modal) {
          modal.style.display = "flex";
          renderCartItems();
        }
      });
    }
    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });

    const allowCancelling = () => {
      var activeBenefits = benefits.filter(b => !b.canBeAdded && !b.isCancel && b.renovationDate.length > 0);
      var remainingBenefits = activeBenefits.filter(b => b.id != benefitCancelId);

      const remainingCategoriesIds = remainingBenefits.reduce((result, item) => {
        if (!result.some(c => c == item.id)) {
          result.push(item.id);
        }
        return result;
      }, []);

      return (remainingCategoriesIds.includes(1) && remainingCategoriesIds.includes(2) && remainingCategoriesIds.includes(3))
    }

    const fetchCancel = () => {
      loadingOverlay.classList.replace("invisible", "visible");
      fetch(window.env.API_URL + "/api/benefit/cancel", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${leadData.token}`,
        },
        body: JSON.stringify({
          benefitId: benefitCancelId,
          comment: cancellationComent.value,
        }),
      })
        .then((response) => response.json())
        .then((response) => {
          if (!response.success) {
            showError(response.errors[0]);
          } else {
            if (modal2) modal2.style.display = "none";

            let benefit = benefits.find((b) => b.id === benefitCancelId);
            Swal.fire({
              icon: "warning",
              title: `Reactivation on ${benefit.renovationDate.split(": ")[1]}`,
              text: `This product has been canceled. It can be reactivated on ${benefit.renovationDate.split(": ")[1]}.`,
              showConfirmButton: false,
              showCloseButton: true,
              willClose: () => {
                window.location.reload();
              },
            });
          }
        })
        .catch((error) => {
          showError(error.description);
        })
        .finally(() => {
          loadingOverlay.classList.replace("visible", "invisible");
        });
    }

    const enableBenefits = () => {
      benefits.forEach((benefit) => {
        if (!benefit.canBeAdded && benefit.renovationDate.length == 0) {
          benefit.canBeAdded = (benefit.points <= (totalPoints - usedPoints))
        }
      })
    }

    if (submitCancelButton) {
      submitCancelButton.addEventListener("click", function () {
        if (allowCancelling()) {
          fetchCancel();
        } else {
          benefits[benefits.findIndex(x => x.id === benefitCancelId)].isCancel = true;
          benefits[benefits.findIndex(x => x.id === benefitCancelId)].comment = cancellationComent.value;
          benefitsToCancel.push(benefits[benefits.findIndex(x => x.id === benefitCancelId)]);
          usedPoints -= benefits[benefits.findIndex(x => x.id === benefitCancelId)].points;
          updatePoints();

          modal2.style.display = "none";
          cancellationComent.value = "";

          enableBenefits();
          renderBenefitCards(
            benefits.filter((benefit) => !benefit.canBeAdded && !benefit.isCancel && benefit.renovationDate.length > 0),
            benefits.filter((benefit) => benefit.canBeAdded),
            benefits.filter((benefit) => !benefit.canBeAdded && benefit.renovationDate.length == 0),
            benefits.filter((benefit) => benefit.isCancel)
          );
          attachBenefitCardListeners();

          cartItems.forEach((item) => {
            let btn = document.querySelector(`button[data-name="${item.benefit}"]`);
            let card = btn.closest(".flex-items");
            card.classList.add("selected-card");
            btn.textContent = "Added to Cart";
            btn.classList.add("selected-btn");
            btn.disabled = true;
          })

          Swal.fire({
            icon: "warning",
            title: `Cancel warning`,
            text: `Remember that you must choose at least one item from each category. This change will not take effect until you meet the requirements again.`,
            confirmButtonText: "OK",
            confirmButtonColor: "#00897b",
          });
        }
      });
    }

    if (confirm3btn) {
      confirm3btn.addEventListener("click", function () {
        let benefit = benefits.find((b) => b.id === confirm3btn.benefitId);
        cartItems.push(benefit);
        modal3.style.display = "none";
        if (modal) {
          modal.style.display = "flex";
          renderCartItems();
        }
        console.log("Ítem agregado al carrito:", benefit);
        updatePoints();
        const card = lastClickedAddToCartBtn.closest(".flex-items");
        card.classList.add("selected-card");
        lastClickedAddToCartBtn.textContent = "Added to Cart";
        lastClickedAddToCartBtn.classList.add("selected-btn");
        lastClickedAddToCartBtn.disabled = true;
      })
    }

    if (closeModal22) {
      closeModal22.addEventListener("click", () => {
        if (modal2) modal2.style.display = "none";
      });
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
      });
    }

    if (cancel3btn) {
      cancel3btn.addEventListener("click", () => {
        if (modal3) modal3.style.display = "none";
      })
    }

    const clearCartBtn = document.getElementById("clear-cart-btn");
    if (clearCartBtn) {
      clearCartBtn.addEventListener("click", function () {
        window.clearCart();
      });
    }
  });

window.clearCart = function () {
  const allButtons = document.querySelectorAll(".add-to-cart-btn");
  allButtons.forEach((button) => {
    button.classList.remove("selected-btn");
    button.textContent = "Add to Cart";
    button.disabled = false;
    const cardElement = button.closest(".flex-items");
    if (cardElement) {
      cardElement.classList.remove("selected-card");
    }
  });
  cartItems = [];
  updatePoints();
  renderCartItems();
};

document.addEventListener("DOMContentLoaded", function () {
  getBenefits();
});
